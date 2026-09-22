import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
              section: { select: { nameAr: true, course: { select: { nameAr: true } } } },
            },
          },
          attachment: { select: { id: true, originalFilename: true, storageProvider: true } },
        },
      }),
      this.prisma.brokenFileReport.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        student: { ...item.student, telegramUserId: item.student.telegramUserId.toString() },
      })),
      total,
      page,
      pageSize,
    };
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
