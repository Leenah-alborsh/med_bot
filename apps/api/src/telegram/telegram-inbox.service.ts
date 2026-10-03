import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@medical/database';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { ScopeAuthorizationService } from '../auth/scope-authorization.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ClassifyTelegramInboxInput,
  ListTelegramInboxInput,
} from './telegram-inbox.schemas.js';

type ChannelMedia = {
  storageChatId: bigint;
  storageMessageId: number;
  telegramFileId: string;
  telegramFileUniqueId: string;
  fileName: string;
  mimeType: string;
  fileSize: bigint;
  mediaType: string;
  linkCode: string | null;
  receivedAt: Date;
};

type TelegramFile = {
  file_id?: unknown;
  file_unique_id?: unknown;
  file_name?: unknown;
  mime_type?: unknown;
  file_size?: unknown;
};

type TelegramMessage = {
  message_id?: unknown;
  date?: unknown;
  chat?: { id?: unknown };
  document?: TelegramFile;
  video?: TelegramFile;
  audio?: TelegramFile;
  voice?: TelegramFile;
  animation?: TelegramFile;
  video_note?: TelegramFile;
  photo?: TelegramFile[];
  caption?: unknown;
};

export const telegramLinkCodePattern = /MED-[A-F0-9]{10}/i;

export function extractTelegramLinkCode(text: unknown) {
  if (typeof text !== 'string') return null;
  return telegramLinkCodePattern.exec(text)?.[0]?.toUpperCase() ?? null;
}

export function extractChannelMedia(update: unknown): ChannelMedia | null {
  if (!update || typeof update !== 'object') return null;
  const source = update as {
    channel_post?: TelegramMessage;
    edited_channel_post?: TelegramMessage;
  };
  const message = source.channel_post ?? source.edited_channel_post;
  if (!message) return null;
  const candidates: Array<[string, TelegramFile | undefined, string, string]> = [
    ['DOCUMENT', message.document, 'application/octet-stream', 'file'],
    ['VIDEO', message.video, 'video/mp4', 'video.mp4'],
    ['AUDIO', message.audio, 'audio/mpeg', 'audio.mp3'],
    ['VOICE', message.voice, 'audio/ogg', 'voice.ogg'],
    ['ANIMATION', message.animation, 'video/mp4', 'animation.mp4'],
    ['VIDEO_NOTE', message.video_note, 'video/mp4', 'video-note.mp4'],
    ['PHOTO', message.photo?.at(-1), 'image/jpeg', 'photo.jpg'],
  ];
  const candidate = candidates.find(([, file]) => file?.file_id && file.file_unique_id);
  const chatId = message.chat?.id;
  const messageId = message.message_id;
  const date = message.date;
  if (!candidate || typeof chatId !== 'number' || !Number.isSafeInteger(chatId)) return null;
  if (typeof messageId !== 'number' || !Number.isSafeInteger(messageId)) return null;
  if (typeof date !== 'number' || !Number.isSafeInteger(date)) return null;
  const [mediaType, file, fallbackMime, fallbackName] = candidate;
  if (!file || typeof file.file_id !== 'string' || typeof file.file_unique_id !== 'string')
    return null;
  const fileSize =
    typeof file.file_size === 'number' && Number.isSafeInteger(file.file_size)
      ? BigInt(file.file_size)
      : 0n;
  return {
    storageChatId: BigInt(chatId),
    storageMessageId: messageId,
    telegramFileId: file.file_id,
    telegramFileUniqueId: file.file_unique_id,
    fileName:
      typeof file.file_name === 'string' && file.file_name.trim()
        ? file.file_name.trim()
        : fallbackName,
    mimeType:
      typeof file.mime_type === 'string' && file.mime_type.trim()
        ? file.mime_type.trim()
        : fallbackMime,
    fileSize,
    mediaType,
    linkCode: extractTelegramLinkCode(message.caption),
    receivedAt: new Date(date * 1000),
  };
}

@Injectable()
export class TelegramInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeAuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async ingest(update: unknown, configuredChannelId?: string) {
    const media = extractChannelMedia(update);
    if (!media || !configuredChannelId || media.storageChatId !== BigInt(configuredChannelId)) {
      return { accepted: false };
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const directAttachment = await tx.contentAttachment.findFirst({
        where: {
          storageChatId: media.storageChatId,
          storageMessageId: media.storageMessageId,
        },
        select: { id: true, contentItemId: true, uploadedById: true },
      });
      const directClassification = directAttachment
        ? {
            status: 'CLASSIFIED' as const,
            contentItemId: directAttachment.contentItemId,
            attachmentId: directAttachment.id,
            classifiedById: directAttachment.uploadedById,
            classifiedAt: new Date(),
          }
        : {};
      const saved = await tx.telegramChannelFile.upsert({
        where: {
          storageChatId_storageMessageId: {
            storageChatId: media.storageChatId,
            storageMessageId: media.storageMessageId,
          },
        },
        create: { ...media, ...directClassification },
        update: {
          telegramFileId: media.telegramFileId,
          telegramFileUniqueId: media.telegramFileUniqueId,
          fileName: media.fileName,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          mediaType: media.mediaType,
          linkCode: media.linkCode,
          ...directClassification,
        },
        select: { id: true, status: true, contentItemId: true, attachmentId: true },
      });
      if (!saved.attachmentId && saved.status === 'UNCLASSIFIED' && media.linkCode) {
        const target = await tx.contentItem.findUnique({
          where: { telegramLinkCode: media.linkCode },
          select: {
            id: true,
            contentType: true,
            createdById: true,
            sourceInboxFile: { select: { id: true } },
          },
        });
        if (
          target?.contentType === 'FILE' &&
          (!target.sourceInboxFile || target.sourceInboxFile.id === saved.id)
        ) {
          const claimed = await tx.telegramChannelFile.updateMany({
            where: {
              id: saved.id,
              status: 'UNCLASSIFIED',
              contentItemId: null,
              attachmentId: null,
            },
            data: {
              status: 'CLASSIFIED',
              contentItemId: target.id,
              classifiedById: target.createdById,
              classifiedAt: new Date(),
            },
          });
          if (claimed.count !== 1) return saved;

          const latest = await tx.contentAttachment.findFirst({
            where: { contentItemId: target.id },
            orderBy: { version: 'desc' },
            select: { version: true },
          });
          const attachment = await tx.contentAttachment.create({
            data: {
              contentItemId: target.id,
              storageProvider: 'TELEGRAM',
              originalFilename: media.fileName,
              telegramFileId: media.telegramFileId,
              telegramFileUniqueId: media.telegramFileUniqueId,
              storageChatId: media.storageChatId,
              storageMessageId: media.storageMessageId,
              mimeType: media.mimeType,
              fileSize: media.fileSize,
              version: (latest?.version ?? 0) + 1,
              uploadedById: target.createdById,
            },
          });
          await tx.telegramChannelFile.update({
            where: { id: saved.id },
            data: {
              attachmentId: attachment.id,
            },
          });
          return {
            ...saved,
            status: 'CLASSIFIED',
            contentItemId: target.id,
            attachmentId: attachment.id,
          };
        }
      }
      if (saved.attachmentId) {
        await tx.contentAttachment.update({
          where: { id: saved.attachmentId },
          data: {
            telegramFileId: media.telegramFileId,
            telegramFileUniqueId: media.telegramFileUniqueId,
            originalFilename: media.fileName,
            mimeType: media.mimeType,
            fileSize: media.fileSize,
            storageChatId: media.storageChatId,
            storageMessageId: media.storageMessageId,
          },
        });
      }
      return saved;
    });
    return { accepted: true, id: row.id };
  }

  async list(input: ListTelegramInboxInput) {
    const where: Prisma.TelegramChannelFileWhereInput = {
      status: 'UNCLASSIFIED',
      ...(input.search
        ? {
            OR: [
              { fileName: { contains: input.search, mode: 'insensitive' } },
              { mimeType: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.telegramChannelFile.findMany({
        where,
        orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.telegramChannelFile.count({ where }),
    ]);
    return this.serialize({ items, total, page: input.page, pageSize: input.pageSize });
  }

  async classify(
    id: string,
    input: ClassifyTelegramInboxInput,
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    if (input.publish && !actor.permissions.includes('content.publish')) {
      throw new ForbiddenException('لا تملك صلاحية نشر المحتوى مباشرة.');
    }
    const inbox = await this.prisma.telegramChannelFile.findUnique({ where: { id } });
    if (!inbox) throw new NotFoundException('الملف الوارد غير موجود.');
    if (inbox.status !== 'UNCLASSIFIED') throw new ConflictException('تم تصنيف هذا الملف مسبقًا.');

    const bot = await this.prisma.bot.findUnique({
      where: { key: 'medical-main' },
      select: { id: true },
    });
    if (!bot) throw new NotFoundException('البوت الرئيسي غير مهيأ.');

    let existingCourse: {
      id: string;
      hasSections: boolean;
      semester: { academicYearId: string };
    } | null = null;
    if (input.courseId) {
      existingCourse = await this.prisma.course.findFirst({
        where: { id: input.courseId, isActive: true, archivedAt: null },
        select: { id: true, hasSections: true, semester: { select: { academicYearId: true } } },
      });
      if (!existingCourse) throw new NotFoundException('المادة غير موجودة.');
      await this.scopes.assertResourceAccess(actor, {
        botId: bot.id,
        academicYearId: existingCourse.semester.academicYearId,
        courseId: existingCourse.id,
      });
    } else if (input.newCourse) {
      const semester = await this.prisma.semester.findFirst({
        where: { id: input.newCourse.semesterId, isActive: true, archivedAt: null },
        select: { academicYearId: true },
      });
      if (!semester) throw new NotFoundException('الفصل الدراسي غير موجود.');
      await this.scopes.assertResourceAccess(actor, {
        botId: bot.id,
        academicYearId: semester.academicYearId,
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.telegramChannelFile.updateMany({
          where: { id, status: 'UNCLASSIFIED' },
          data: { status: 'CLASSIFIED', classifiedById: actor.id, classifiedAt: new Date() },
        });
        if (claimed.count !== 1) throw new ConflictException('تم تصنيف هذا الملف مسبقًا.');

        const course =
          existingCourse ??
          (await tx.course.create({
            data: {
              semesterId: input.newCourse!.semesterId,
              nameAr: input.newCourse!.nameAr,
              nameEn: input.newCourse!.nameEn || input.newCourse!.nameAr,
              displayOrder: input.newCourse!.displayOrder,
              hasSections: input.newCourse!.hasSections,
            },
            select: { id: true, hasSections: true },
          }));

        let sectionId = input.sectionId;
        if (sectionId) {
          const section = await tx.section.findFirst({
            where: { id: sectionId, courseId: course.id, isActive: true, archivedAt: null },
            select: { id: true },
          });
          if (!section) throw new BadRequestException('القسم لا يتبع المادة المحددة.');
        } else if (input.newSection) {
          if (!course.hasSections)
            throw new BadRequestException('هذه المادة مضبوطة للعمل بدون أقسام.');
          sectionId = (
            await tx.section.create({
              data: {
                courseId: course.id,
                nameAr: input.newSection.nameAr,
                nameEn: input.newSection.nameEn || input.newSection.nameAr,
                displayOrder: input.newSection.displayOrder,
              },
              select: { id: true },
            })
          ).id;
        } else if (!course.hasSections) {
          const existing = await tx.section.findFirst({
            where: { courseId: course.id },
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
            select: { id: true },
          });
          sectionId =
            existing?.id ??
            (
              await tx.section.create({
                data: {
                  courseId: course.id,
                  nameAr: input.newCourse?.nameAr ?? 'ملفات المادة',
                  nameEn: '__course__',
                  displayOrder: 0,
                },
                select: { id: true },
              })
            ).id;
        } else {
          throw new BadRequestException('القسم مطلوب لهذه المادة.');
        }

        let category = await tx.contentCategory.findFirst({
          where: { sectionId, nameEn: '__inbox_files__' },
          select: { id: true, isActive: true },
        });
        if (!category) {
          const maximum = await tx.contentCategory.aggregate({
            where: { sectionId },
            _max: { displayOrder: true },
          });
          category = await tx.contentCategory.create({
            data: {
              sectionId,
              nameAr: 'ملفات',
              nameEn: '__inbox_files__',
              displayOrder: (maximum._max.displayOrder ?? -1) + 1,
            },
            select: { id: true, isActive: true },
          });
        } else if (!category.isActive) {
          await tx.contentCategory.update({
            where: { id: category.id },
            data: { isActive: true, archivedAt: null },
          });
        }

        const publishedAt = input.publish ? new Date() : null;
        const content = await tx.contentItem.create({
          data: {
            sectionId,
            contentCategoryId: category.id,
            titleAr: input.titleAr,
            titleEn: input.titleEn,
            descriptionAr: input.descriptionAr,
            contentType: 'FILE',
            state: input.publish ? 'PUBLISHED' : 'DRAFT',
            displayOrder: input.displayOrder,
            publishedAt,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
        const attachment = await tx.contentAttachment.create({
          data: {
            contentItemId: content.id,
            storageProvider: 'TELEGRAM',
            originalFilename: inbox.fileName,
            telegramFileId: inbox.telegramFileId,
            telegramFileUniqueId: inbox.telegramFileUniqueId,
            storageChatId: inbox.storageChatId,
            storageMessageId: inbox.storageMessageId,
            mimeType: inbox.mimeType,
            fileSize: inbox.fileSize,
            uploadedById: actor.id,
          },
        });
        await tx.telegramChannelFile.update({
          where: { id },
          data: { contentItemId: content.id, attachmentId: attachment.id },
        });
        await this.audit.record({
          actorId: actor.id,
          actionKey: input.publish ? 'telegram-inbox.classify-publish' : 'telegram-inbox.classify',
          entityType: 'TelegramChannelFile',
          entityId: id,
          after: {
            contentItemId: content.id,
            attachmentId: attachment.id,
            courseId: course.id,
            sectionId,
          },
          metadata,
          client: tx,
        });
        return this.serialize({ contentItemId: content.id, state: content.state });
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('ترتيب العرض مستخدم مسبقًا في المسار المحدد.');
      }
      throw error;
    }
  }

  private serialize<T>(value: T): T {
    return JSON.parse(
      JSON.stringify(value, (_key, nested: unknown) =>
        typeof nested === 'bigint' ? nested.toString() : nested,
      ),
    ) as T;
  }
}
