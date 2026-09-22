import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import { SUPER_ADMIN_ROLE_KEY } from '@medical/shared';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { ScopeAuthorizationService } from '../auth/scope-authorization.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AttachmentInput, ContentInput, ListContentInput } from './content.schemas.js';
import { isPathInsideUploadRoot } from './upload.js';
import { TelegramFileStorageService } from './telegram-file-storage.service.js';
import { UploadTicketService } from './upload-ticket.service.js';

type Actor = Pick<AuthenticatedAdmin, 'id' | 'roleKeys'>;
const privateHost =
  /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

export function validateExternalUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid external URL');
  }
  if (url.protocol !== 'https:' || privateHost.test(url.hostname))
    throw new BadRequestException('Only public HTTPS URLs are allowed');
  return url.toString();
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeAuthorizationService,
    private readonly audit: AuditService,
    private readonly telegramStorage: TelegramFileStorageService,
    private readonly uploadTickets: UploadTicketService,
  ) {}

  async list(query: ListContentInput, actor: Actor) {
    const rows = await this.prisma.contentItem.findMany({
      where: {
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.courseId ? { section: { courseId: query.courseId } } : {}),
        ...(query.semesterId ? { section: { course: { semesterId: query.semesterId } } } : {}),
        ...(query.yearId
          ? { section: { course: { semester: { academicYearId: query.yearId } } } }
          : {}),
        ...(query.state ? { state: query.state } : {}),
        ...(query.type ? { contentType: query.type } : {}),
        ...(query.search
          ? {
              OR: [
                { titleAr: { contains: query.search, mode: 'insensitive' } },
                { titleEn: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sectionId: true,
        titleAr: true,
        titleEn: true,
        descriptionAr: true,
        descriptionEn: true,
        bodyText: true,
        contentType: true,
        state: true,
        isActive: true,
        displayOrder: true,
        publishedAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        section: {
          select: {
            nameAr: true,
            course: {
              select: { id: true, nameAr: true, semester: { select: { academicYearId: true } } },
            },
          },
        },
        attachments: {
          select: {
            id: true,
            storageProvider: true,
            originalFilename: true,
            externalUrl: true,
            telegramFileId: true,
            telegramFileUniqueId: true,
            storageMessageId: true,
            version: true,
            isCurrent: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ sectionId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
    });
    const bot = await this.mainBot();
    const visible = actor.roleKeys.includes(SUPER_ADMIN_ROLE_KEY) ? rows : [];
    if (!actor.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
      for (const row of rows) {
        try {
          await this.scopes.assertResourceAccess(actor, {
            botId: bot.id,
            academicYearId: row.section.course.semester.academicYearId,
            courseId: row.section.course.id,
          });
          visible.push(row);
        } catch {
          /* Omit resources outside scope. */
        }
      }
    }
    const start = (query.page - 1) * query.pageSize;
    return {
      items: visible.slice(start, start + query.pageSize).map((row) => this.serialize(row)),
      total: visible.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string, actor: Actor) {
    const row = await this.prisma.contentItem.findUnique({
      where: { id },
      include: {
        attachments: true,
        section: { include: { course: { include: { semester: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Content item not found');
    await this.assertScope(
      actor,
      row.section.course.id,
      row.section.course.semester.academicYearId,
    );
    return this.serialize(row);
  }

  async create(input: ContentInput, actor: Actor, metadata: RequestMetadata) {
    const target = await this.sectionTarget(input.sectionId);
    await this.assertScope(actor, target.courseId, target.academicYearId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.contentItem.create({
        data: { ...input, createdById: actor.id, updatedById: actor.id },
      });
      await this.audit.record({
        actorId: actor.id,
        actionKey: 'content.create',
        entityType: 'ContentItem',
        entityId: row.id,
        after: row,
        metadata,
        client: tx,
      });
      return this.serialize(row);
    });
  }

  async update(id: string, input: Partial<ContentInput>, actor: Actor, metadata: RequestMetadata) {
    const existing = await this.contentTarget(id);
    await this.assertScope(actor, existing.courseId, existing.academicYearId);
    if (input.sectionId) {
      const target = await this.sectionTarget(input.sectionId);
      await this.assertScope(actor, target.courseId, target.academicYearId);
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.contentItem.findUniqueOrThrow({ where: { id } });
      const row = await tx.contentItem.update({
        where: { id },
        data: { ...input, updatedById: actor.id },
      });
      await this.audit.record({
        actorId: actor.id,
        actionKey: input.displayOrder === undefined ? 'content.update' : 'content.reorder',
        entityType: 'ContentItem',
        entityId: id,
        before,
        after: row,
        metadata,
        client: tx,
      });
      return this.serialize(row);
    });
  }

  async setState(
    id: string,
    state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    const existing = await this.contentTarget(id);
    await this.assertScope(actor, existing.courseId, existing.academicYearId);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.contentItem.findUniqueOrThrow({ where: { id } });
      const row = await tx.contentItem.update({
        where: { id },
        data: {
          state,
          isActive: state !== 'ARCHIVED',
          publishedAt: state === 'PUBLISHED' ? new Date() : before.publishedAt,
          archivedAt: state === 'ARCHIVED' ? new Date() : null,
          updatedById: actor.id,
        },
      });
      await this.audit.record({
        actorId: actor.id,
        actionKey:
          state === 'PUBLISHED'
            ? 'content.publish'
            : state === 'ARCHIVED'
              ? 'content.archive'
              : 'content.unpublish',
        entityType: 'ContentItem',
        entityId: id,
        before,
        after: row,
        metadata,
        client: tx,
      });
      return this.serialize(row);
    });
  }

  async attach(id: string, input: AttachmentInput, actor: Actor, metadata: RequestMetadata) {
    const target = await this.contentTarget(id);
    await this.assertScope(actor, target.courseId, target.academicYearId);
    const data = {
      contentItemId: id,
      storageProvider: input.storageProvider,
      originalFilename: basename(input.originalFilename),
      externalUrl: input.externalUrl ? validateExternalUrl(input.externalUrl) : null,
      telegramFileId: input.telegramFileId ?? null,
      mimeType: input.mimeType,
      fileSize: BigInt(input.fileSize),
    };
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.contentAttachment.create({ data });
      await this.audit.record({
        actorId: actor.id,
        actionKey: 'content.attachment.create',
        entityType: 'ContentAttachment',
        entityId: row.id,
        after: this.serialize(row),
        metadata,
        client: tx,
      });
      return this.serialize(row);
    });
  }

  async issueUploadTicket(id: string, actor: AuthenticatedAdmin) {
    const target = await this.contentTarget(id);
    await this.assertScope(actor, target.courseId, target.academicYearId);
    return this.uploadTickets.issue(id, actor);
  }

  async attachUpload(
    id: string,
    file: Express.Multer.File | undefined,
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    if (!file) throw new BadRequestException('الملف مطلوب');
    let stored: Awaited<ReturnType<TelegramFileStorageService['store']>> | undefined;
    try {
      if (!isPathInsideUploadRoot(file.path)) throw new BadRequestException('مسار رفع غير صالح');
      const target = await this.contentTarget(id);
      await this.assertScope(actor, target.courseId, target.academicYearId);
      const checksum = await this.checksum(file.path);
      const duplicate = await this.prisma.contentAttachment.findFirst({
        where: { contentItemId: id, checksum },
      });
      if (duplicate) return this.serialize(duplicate);

      stored = await this.telegramStorage.store(
        file.path,
        basename(file.originalname),
        file.mimetype,
      );
      const row = await this.prisma.$transaction(async (tx) => {
        const latest = await tx.contentAttachment.findFirst({
          where: { contentItemId: id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        await tx.contentAttachment.updateMany({
          where: { contentItemId: id, isCurrent: true },
          data: { isCurrent: false, archivedAt: new Date() },
        });
        const created = await tx.contentAttachment.create({
          data: {
            contentItemId: id,
            storageProvider: 'TELEGRAM',
            originalFilename: basename(file.originalname),
            telegramFileId: stored!.telegramFileId,
            telegramFileUniqueId: stored!.telegramFileUniqueId,
            storageChatId: stored!.storageChatId,
            storageMessageId: stored!.storageMessageId,
            mimeType: file.mimetype,
            fileSize: BigInt(file.size),
            checksum,
            version: (latest?.version ?? 0) + 1,
            uploadedById: actor.id,
          },
        });
        await this.audit.record({
          actorId: actor.id,
          actionKey: latest ? 'content.attachment.replace' : 'content.attachment.upload',
          entityType: 'ContentAttachment',
          entityId: created.id,
          after: this.serialize(created),
          metadata,
          client: tx,
        });
        return created;
      });
      return this.serialize(row);
    } catch (error) {
      if (stored) await this.telegramStorage.compensate(stored);
      throw error;
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  verifyStorage() {
    return this.telegramStorage.verifyConfiguration();
  }

  private async checksum(path: string) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private serialize<T>(value: T): T {
    return JSON.parse(
      JSON.stringify(value, (_key, nested: unknown) =>
        typeof nested === 'bigint' ? nested.toString() : nested,
      ),
    ) as T;
  }
  private async mainBot() {
    const bot = await this.prisma.bot.findUnique({
      where: { key: 'medical-main' },
      select: { id: true },
    });
    if (!bot) throw new NotFoundException('Main bot is not configured');
    return bot;
  }
  private async assertScope(actor: Actor, courseId: string, academicYearId: string) {
    const bot = await this.mainBot();
    await this.scopes.assertResourceAccess(actor, { botId: bot.id, academicYearId, courseId });
  }
  private async sectionTarget(id: string) {
    const row = await this.prisma.section.findUnique({
      where: { id },
      select: {
        courseId: true,
        course: { select: { semester: { select: { academicYearId: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Section not found');
    return { courseId: row.courseId, academicYearId: row.course.semester.academicYearId };
  }
  private async contentTarget(id: string) {
    const row = await this.prisma.contentItem.findUnique({
      where: { id },
      select: {
        section: {
          select: {
            courseId: true,
            course: { select: { semester: { select: { academicYearId: true } } } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Content item not found');
    return {
      courseId: row.section.courseId,
      academicYearId: row.section.course.semester.academicYearId,
    };
  }
}
