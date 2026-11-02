import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const workActions = [
  'content.create',
  'content.update',
  'content.reorder',
  'content.publish',
  'content.archive',
  'content.unpublish',
  'content.delete',
  'content.attachment.create',
  'content.attachment.upload',
  'catalog.create',
  'catalog.update',
  'catalog.reorder',
  'catalog.delete',
  'telegram-inbox.classify',
  'telegram-inbox.classify-publish',
  'telegram-inbox.attach',
  'broken-file-report.status.update',
];

export function monthBounds(month: string) {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  const midnight = (y: number, m: number) => {
    const utc = new Date(Date.UTC(y, m, 1));
    const offset =
      new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Hebron',
        timeZoneName: 'shortOffset',
      })
        .formatToParts(utc)
        .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offset);
    const minutes = match
      ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === '-' ? -1 : 1)
      : 0;
    return new Date(utc.getTime() - minutes * 60_000);
  };
  return { gte: midnight(year, number - 1), lt: midnight(year, number) };
}

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(actor: AuthenticatedAdmin, month: string, adminId?: string, page = 1) {
    if (!actor.roleKeys.includes('super-admin')) throw new ForbiddenException('Super Admin only');
    const createdAt = monthBounds(month);
    const [admins, uploads, actions]: [
      Array<{ id: string; displayNameAr: string; email: string }>,
      Array<{ uploadedById: string | null; _count: { _all: number } }>,
      Array<{
        actorId: string | null;
        actionKey: string;
        _count: { _all: number };
        _max: { createdAt: Date | null };
      }>,
    ] = await Promise.all([
      this.prisma.adminUser.findMany({
        select: { id: true, displayNameAr: true, email: true },
        orderBy: { displayNameAr: 'asc' },
      }),
      this.prisma.contentAttachment.groupBy({
        by: ['uploadedById'],
        where: { createdAt, storageProvider: 'TELEGRAM' },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId', 'actionKey'],
        where: { createdAt, actorId: { not: null }, actionKey: { in: workActions } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);
    const totalUploads = uploads
      .filter((row) => row.uploadedById !== null)
      .reduce((sum, row) => sum + row._count._all, 0);
    const items = admins
      .map((admin) => {
        const count = uploads.find((row) => row.uploadedById === admin.id)?._count._all ?? 0;
        const activity = actions.filter((row) => row.actorId === admin.id);
        return {
          ...admin,
          uploads: count,
          percentage: totalUploads ? Math.round((count / totalUploads) * 1000) / 10 : 0,
          actions: activity.map((row) => ({ actionKey: row.actionKey, count: row._count._all })),
          totalActions: activity.reduce((sum, row) => sum + row._count._all, 0),
          lastActivity:
            activity
              .map((row) => row._max.createdAt)
              .filter((date): date is Date => date !== null)
              .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
        };
      })
      .sort(
        (a, b) =>
          b.uploads - a.uploads ||
          b.totalActions - a.totalActions ||
          a.displayNameAr.localeCompare(b.displayNameAr),
      );
    let details = null;
    if (adminId) {
      const where = { createdAt, uploadedById: adminId, storageProvider: 'TELEGRAM' as const };
      const [files, totalFiles, events] = await Promise.all([
        this.prisma.contentAttachment.findMany({
          where,
          select: {
            id: true,
            originalFilename: true,
            contentItemId: true,
            createdAt: true,
            contentItem: { select: { titleAr: true, state: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * 20,
          take: 20,
        }),
        this.prisma.contentAttachment.count({ where }),
        this.prisma.auditLog.findMany({
          where: { createdAt, actorId: adminId, actionKey: { in: workActions } },
          select: { id: true, actionKey: true, entityType: true, entityId: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 50,
        }),
      ]);
      details = { files, totalFiles, events, page, pageSize: 20 };
    }
    return {
      month,
      timeZone: 'Asia/Hebron',
      totalUploads,
      unattributedUploads: uploads.find((row) => row.uploadedById === null)?._count._all ?? 0,
      items,
      details,
    };
  }
}
