import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@medical/database';
import { SUPER_ADMIN_ROLE_KEY } from '@medical/shared';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeAuthorizationService } from '../auth/scope-authorization.service.js';

const ARCHIVE_REPORT_NOTE = 'تمت أرشفة المحتوى من البوت مع الاحتفاظ بالملفات لإمكانية الاسترجاع.';

export function reportFilePreview(attachment: {
  storageChatId: bigint | null;
  storageMessageId: number | null;
}) {
  const channel = attachment.storageChatId?.toString();
  if (!channel?.startsWith('-100') || !attachment.storageMessageId) return null;
  return `https://t.me/c/${channel.slice(4)}/${attachment.storageMessageId}`;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopes: ScopeAuthorizationService,
  ) {}
  async list(
    status: 'OPEN' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' | undefined,
    page: number,
    pageSize: number,
  ) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.brokenFileReport.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          reasonCategory: true,
          status: true,
          resolutionNote: true,
          reviewedAt: true,
          createdAt: true,
          student: { select: { id: true, telegramUserId: true, username: true } },
          contentItem: {
            select: {
              id: true,
              titleAr: true,
              state: true,
              _count: { select: { attachments: { where: { isCurrent: true } } } },
              section: { select: { nameAr: true, course: { select: { id: true, nameAr: true } } } },
            },
          },
          attachment: {
            select: {
              id: true,
              originalFilename: true,
              storageProvider: true,
              isCurrent: true,
              storageChatId: true,
              storageMessageId: true,
            },
          },
        },
      }),
      this.prisma.brokenFileReport.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        attachment: item.attachment
          ? {
              id: item.attachment.id,
              originalFilename: item.attachment.originalFilename,
              storageProvider: item.attachment.storageProvider,
              isCurrent: item.attachment.isCurrent,
              previewUrl: reportFilePreview(item.attachment),
            }
          : null,
        student: { ...item.student, telegramUserId: item.student.telegramUserId.toString() },
      })),
      total,
      page,
      pageSize,
    };
  }
  async archiveContent(id: string, actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    return this.prisma.$transaction(
      async (tx) => {
        const report = await tx.brokenFileReport.findUnique({
          where: { id },
          include: {
            attachment: { select: { isCurrent: true } },
            contentItem: {
              include: { section: { include: { course: { include: { semester: true } } } } },
            },
          },
        });
        if (!report) throw new NotFoundException('Report not found');
        if (report.contentItem.contentType !== 'FILE')
          throw new BadRequestException('المحتوى ليس ملفاً قابلاً للأرشفة من البلاغ.');
        if (report.attachment && !report.attachment.isCurrent)
          throw new BadRequestException(
            'البلاغ يخص نسخة قديمة تم استبدالها؛ راجع الملفات الحالية قبل الأرشفة.',
          );
        if (!actor.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
          const bot = await tx.bot.findUniqueOrThrow({
            where: { key: 'medical-main' },
            select: { id: true },
          });
          await this.scopes.assertResourceAccess(actor, {
            botId: bot.id,
            courseId: report.contentItem.section.courseId,
            academicYearId: report.contentItem.section.course.semester.academicYearId,
          });
        }
        const now = new Date();
        const before = await tx.contentItem.findUniqueOrThrow({
          where: { id: report.contentItemId },
        });
        if (before.state !== 'ARCHIVED' || before.isActive || !before.archivedAt) {
          const after = await tx.contentItem.update({
            where: { id: before.id },
            data: { state: 'ARCHIVED', isActive: false, archivedAt: now, updatedById: actor.id },
          });
          await this.audit.record({
            actorId: actor.id,
            actionKey: 'content.archive',
            entityType: 'ContentItem',
            entityId: before.id,
            before,
            after,
            metadata,
            client: tx,
          });
        }
        const reportBefore = {
          id: report.id,
          studentId: report.studentId,
          contentItemId: report.contentItemId,
          attachmentId: report.attachmentId,
          reasonCategory: report.reasonCategory,
          status: report.status,
          reviewedById: report.reviewedById,
          reviewedAt: report.reviewedAt,
          resolutionNote: report.resolutionNote,
          createdAt: report.createdAt,
        };
        const updated = await tx.brokenFileReport.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            reviewedById: actor.id,
            reviewedAt: now,
            resolutionNote: report.resolutionNote?.includes(ARCHIVE_REPORT_NOTE)
              ? report.resolutionNote
              : [report.resolutionNote, ARCHIVE_REPORT_NOTE].filter(Boolean).join('\n'),
          },
        });
        await this.audit.record({
          actorId: actor.id,
          actionKey: 'broken-file-report.status.update',
          entityType: 'BrokenFileReport',
          entityId: id,
          before: reportBefore,
          after: updated,
          metadata,
          client: tx,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async update(
    id: string,
    input: { status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED'; resolutionNote?: string },
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.brokenFileReport.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Report not found');
      const row = await tx.brokenFileReport.update({
        where: { id },
        data: { ...input, reviewedById: actor.id, reviewedAt: new Date() },
      });
      await this.audit.record({
        actorId: actor.id,
        actionKey: 'broken-file-report.status.update',
        entityType: 'BrokenFileReport',
        entityId: id,
        before,
        after: row,
        metadata,
        client: tx,
      });
      return row;
    });
  }
  async usage(from?: Date, to?: Date) {
    const createdAt =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
    const groups = await this.prisma.contentAccessEvent.groupBy({
      by: ['contentItemId'],
      where: createdAt ? { createdAt } : {},
      _count: { _all: true },
      orderBy: { _count: { contentItemId: 'desc' } },
      take: 20,
    });
    const content = await this.prisma.contentItem.findMany({
      where: { id: { in: groups.map((group) => group.contentItemId) } },
      select: {
        id: true,
        titleAr: true,
        contentType: true,
        section: { select: { course: { select: { id: true, nameAr: true } } } },
      },
    });
    const byId = new Map(content.map((item) => [item.id, item]));
    const mostOpened = groups.flatMap((group) => {
      const item = byId.get(group.contentItemId);
      return item ? [{ ...item, count: group._count._all }] : [];
    });
    const courseMap = new Map<string, { courseId: string; nameAr: string; count: number }>();
    for (const row of mostOpened) {
      const course = row.section.course;
      const current = courseMap.get(course.id) ?? {
        courseId: course.id,
        nameAr: course.nameAr,
        count: 0,
      };
      current.count += row.count;
      courseMap.set(course.id, current);
    }
    return {
      mostOpened,
      mostUsedCourses: [...courseMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    };
  }
}
