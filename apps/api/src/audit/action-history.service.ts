import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@medical/database';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

const reversible = new Set([
  'catalog.update',
  'catalog.reorder',
  'content.update',
  'content.reorder',
  'content.publish',
  'content.archive',
  'content.unpublish',
]);

const optionalString = (value: unknown) => (typeof value === 'string' ? value : null);
const optionalDate = (value: unknown) => {
  const raw = optionalString(value);
  return raw ? new Date(raw) : null;
};

type HistoryRow = {
  id: string;
  actionKey: string;
  entityType: string;
  entityId: string | null;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  createdAt: Date;
};

function markerTarget(row: HistoryRow) {
  if (!row.after || typeof row.after !== 'object' || Array.isArray(row.after)) return undefined;
  const value = (row.after as Record<string, unknown>).targetAuditId;
  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class ActionHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async rows(actorId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        actorId,
        actionKey: { in: [...reversible, 'action.undo', 'action.redo'] },
      },
      select: {
        id: true,
        actionKey: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return rows.reverse();
  }

  private state(rows: HistoryRow[]) {
    const actions = rows.filter((row) => reversible.has(row.actionKey));
    const applied = new Map(actions.map((row) => [row.id, true]));
    const changedAt = new Map(actions.map((row) => [row.id, row.createdAt]));
    for (const row of rows) {
      const target = markerTarget(row);
      if (!target || !applied.has(target)) continue;
      if (row.actionKey === 'action.undo') applied.set(target, false);
      if (row.actionKey === 'action.redo') applied.set(target, true);
      changedAt.set(target, row.createdAt);
    }
    const undo = [...actions].reverse().find((row) => applied.get(row.id));
    const redo = [...actions]
      .filter((row) => !applied.get(row.id))
      .sort(
        (a, b) => (changedAt.get(b.id)?.getTime() ?? 0) - (changedAt.get(a.id)?.getTime() ?? 0),
      )[0];
    return { undo, redo };
  }

  async status(actorId: string) {
    const { undo, redo } = this.state(await this.rows(actorId));
    return {
      canUndo: Boolean(undo),
      canRedo: Boolean(redo),
      undoLabel: undo ? this.label(undo) : null,
      redoLabel: redo ? this.label(redo) : null,
    };
  }

  async undo(actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    const { undo } = this.state(await this.rows(actor.id));
    if (!undo) throw new BadRequestException('لا توجد عملية قابلة للتراجع.');
    await this.apply(undo, 'before', actor, metadata);
    return this.status(actor.id);
  }

  async redo(actor: AuthenticatedAdmin, metadata: RequestMetadata) {
    const { redo } = this.state(await this.rows(actor.id));
    if (!redo) throw new BadRequestException('لا توجد عملية قابلة للتقدم.');
    await this.apply(redo, 'after', actor, metadata);
    return this.status(actor.id);
  }

  private async apply(
    action: HistoryRow,
    direction: 'before' | 'after',
    actor: AuthenticatedAdmin,
    metadata: RequestMetadata,
  ) {
    if (!action.entityId) throw new NotFoundException('العنصر المرتبط بالعملية غير موجود.');
    const requiredPermission =
      action.entityType === 'ContentItem' ? 'content.update' : 'catalog.update';
    if (!actor.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('لم تعد لديك صلاحية عكس هذه العملية.');
    }
    const snapshot = action[direction];
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new BadRequestException('لا تحتوي العملية على بيانات كافية لعكسها.');
    }
    const value = snapshot as Record<string, unknown>;
    await this.prisma.$transaction(async (tx) => {
      if (action.entityType === 'year')
        await tx.academicYear.update({
          where: { id: action.entityId! },
          data: this.catalogData(value),
        });
      else if (action.entityType === 'semester')
        await tx.semester.update({
          where: { id: action.entityId! },
          data: this.catalogData(value),
        });
      else if (action.entityType === 'course')
        await tx.course.update({ where: { id: action.entityId! }, data: this.catalogData(value) });
      else if (action.entityType === 'section')
        await tx.section.update({ where: { id: action.entityId! }, data: this.catalogData(value) });
      else if (action.entityType === 'content-type')
        await tx.contentCategory.update({
          where: { id: action.entityId! },
          data: this.catalogData(value),
        });
      else if (action.entityType === 'ContentItem')
        await tx.contentItem.update({
          where: { id: action.entityId! },
          data: this.contentData(value, actor.id),
        });
      else throw new BadRequestException('هذه العملية غير قابلة للتراجع.');

      await this.audit.record({
        actorId: actor.id,
        actionKey: direction === 'before' ? 'action.undo' : 'action.redo',
        entityType: action.entityType,
        entityId: action.entityId ?? undefined,
        after: { targetAuditId: action.id },
        metadata,
        client: tx,
      });
    });
  }

  private catalogData(value: Record<string, unknown>) {
    return {
      ...('nameAr' in value ? { nameAr: String(value.nameAr) } : {}),
      ...('nameEn' in value ? { nameEn: String(value.nameEn) } : {}),
      ...('displayOrder' in value ? { displayOrder: Number(value.displayOrder) } : {}),
      ...('isActive' in value ? { isActive: Boolean(value.isActive) } : {}),
      ...('archivedAt' in value ? { archivedAt: optionalDate(value.archivedAt) } : {}),
    };
  }

  private contentData(value: Record<string, unknown>, actorId: string) {
    return {
      ...('sectionId' in value ? { sectionId: String(value.sectionId) } : {}),
      ...('contentCategoryId' in value
        ? { contentCategoryId: String(value.contentCategoryId) }
        : {}),
      ...('titleAr' in value ? { titleAr: String(value.titleAr) } : {}),
      ...('titleEn' in value ? { titleEn: optionalString(value.titleEn) } : {}),
      ...('bodyText' in value ? { bodyText: optionalString(value.bodyText) } : {}),
      ...('contentType' in value
        ? { contentType: value.contentType as 'TEXT' | 'LINK' | 'FILE' }
        : {}),
      ...('state' in value ? { state: value.state as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' } : {}),
      ...('isActive' in value ? { isActive: Boolean(value.isActive) } : {}),
      ...('displayOrder' in value ? { displayOrder: Number(value.displayOrder) } : {}),
      ...('publishedAt' in value ? { publishedAt: optionalDate(value.publishedAt) } : {}),
      ...('archivedAt' in value ? { archivedAt: optionalDate(value.archivedAt) } : {}),
      updatedById: actorId,
    };
  }

  private label(action: HistoryRow) {
    if (action.entityType === 'ContentItem') return 'آخر تعديل على المحتوى';
    return 'آخر تعديل على الهيكل الأكاديمي';
  }
}
