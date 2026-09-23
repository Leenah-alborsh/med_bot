import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@medical/database';
import { SUPER_ADMIN_ROLE_KEY } from '@medical/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScopeAuthorizationService } from '../auth/scope-authorization.service.js';
import type { AuthenticatedAdmin, RequestMetadata } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import type { ListCatalogInput } from './catalog.schemas.js';

type Actor = Pick<AuthenticatedAdmin, 'id' | 'roleKeys'>;
type ScopedRow = { botId?: string; academicYearId: string; courseId?: string };

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: ScopeAuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private async visible<T extends ScopedRow>(actor: Actor, rows: T[]) {
    if (actor.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) return rows;
    const scopes = await this.prisma.adminScope.findMany({ where: { adminUserId: actor.id } });
    if (scopes.length === 0) return rows;
    return rows.filter((row) =>
      scopes.some(
        (scope) =>
          (scope.botId === null || scope.botId === row.botId) &&
          (scope.academicYearId === null || scope.academicYearId === row.academicYearId) &&
          (scope.courseId === null || scope.courseId === row.courseId),
      ),
    );
  }

  private page<T>(rows: T[], query: ListCatalogInput) {
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      total: rows.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async years(query: ListCatalogInput, actor: Actor) {
    const bot = await this.mainBot();
    const rows = await this.prisma.academicYear.findMany({
      where: {
        ...(query.active ? { isActive: query.active === 'true' } : {}),
        ...(query.search
          ? {
              OR: [
                { nameAr: { contains: query.search, mode: 'insensitive' } },
                { nameEn: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        number: true,
        nameAr: true,
        nameEn: true,
        displayOrder: true,
        isActive: true,
        archivedAt: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    const scoped = await this.visible(
      actor,
      rows.map((row) => ({ ...row, botId: bot.id, academicYearId: row.id })),
    );
    return this.page(scoped, query);
  }

  async semesters(query: ListCatalogInput, actor: Actor) {
    const bot = await this.mainBot();
    const rows = await this.prisma.semester.findMany({
      where: {
        ...(query.yearId ? { academicYearId: query.yearId } : {}),
        ...(query.active ? { isActive: query.active === 'true' } : {}),
        ...(query.search
          ? {
              OR: [
                { nameAr: { contains: query.search, mode: 'insensitive' } },
                { nameEn: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        academicYearId: true,
        nameAr: true,
        nameEn: true,
        displayOrder: true,
        isActive: true,
        archivedAt: true,
      },
      orderBy: [{ academicYearId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
    });
    return this.page(
      await this.visible(
        actor,
        rows.map((row) => ({ ...row, botId: bot.id })),
      ),
      query,
    );
  }

  async courses(query: ListCatalogInput, actor: Actor) {
    const bot = await this.mainBot();
    const rows = await this.prisma.course.findMany({
      where: {
        ...(query.semesterId ? { semesterId: query.semesterId } : {}),
        ...(query.yearId ? { semester: { academicYearId: query.yearId } } : {}),
        ...(query.active ? { isActive: query.active === 'true' } : {}),
        ...(query.search
          ? {
              OR: [
                { nameAr: { contains: query.search, mode: 'insensitive' } },
                { nameEn: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        semesterId: true,
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        descriptionEn: true,
        displayOrder: true,
        isActive: true,
        archivedAt: true,
        semester: { select: { academicYearId: true } },
      },
      orderBy: [{ semesterId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
    });
    const shaped = rows.map(({ semester, ...row }) => ({
      ...row,
      botId: bot.id,
      academicYearId: semester.academicYearId,
      courseId: row.id,
    }));
    return this.page(await this.visible(actor, shaped), query);
  }

  async sections(query: ListCatalogInput, actor: Actor) {
    const bot = await this.mainBot();
    const rows = await this.prisma.section.findMany({
      where: {
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.semesterId ? { course: { semesterId: query.semesterId } } : {}),
        ...(query.yearId ? { course: { semester: { academicYearId: query.yearId } } } : {}),
        ...(query.active ? { isActive: query.active === 'true' } : {}),
        ...(query.search
          ? {
              OR: [
                { nameAr: { contains: query.search, mode: 'insensitive' } },
                { nameEn: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        courseId: true,
        parentId: true,
        nameAr: true,
        nameEn: true,
        displayOrder: true,
        isActive: true,
        archivedAt: true,
        course: { select: { semester: { select: { id: true, academicYearId: true } } } },
      },
      orderBy: [{ courseId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
    });
    const shaped = rows.map(({ course, ...row }) => ({
      ...row,
      botId: bot.id,
      academicYearId: course.semester.academicYearId,
      semesterId: course.semester.id,
    }));
    return this.page(await this.visible(actor, shaped), query);
  }

  async contentCategories(query: ListCatalogInput, actor: Actor) {
    const bot = await this.mainBot();
    const rows = await this.prisma.contentCategory.findMany({
      where: {
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.courseId ? { section: { courseId: query.courseId } } : {}),
        ...(query.semesterId ? { section: { course: { semesterId: query.semesterId } } } : {}),
        ...(query.yearId
          ? { section: { course: { semester: { academicYearId: query.yearId } } } }
          : {}),
        ...(query.active ? { isActive: query.active === 'true' } : {}),
        ...(query.search
          ? {
              OR: [
                { nameAr: { contains: query.search, mode: 'insensitive' as const } },
                { nameEn: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sectionId: true,
        nameAr: true,
        nameEn: true,
        displayOrder: true,
        isActive: true,
        archivedAt: true,
        section: {
          select: {
            courseId: true,
            course: {
              select: { semesterId: true, semester: { select: { academicYearId: true } } },
            },
          },
        },
      },
      orderBy: [{ sectionId: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
    });
    const shaped = rows.map(({ section, ...row }) => ({
      ...row,
      botId: bot.id,
      courseId: section.courseId,
      semesterId: section.course.semesterId,
      academicYearId: section.course.semester.academicYearId,
    }));
    return this.page(await this.visible(actor, shaped), query);
  }
  async create(
    kind: 'year' | 'semester' | 'course' | 'section' | 'content-type',
    input: Record<string, unknown>,
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    const scope = await this.scopeForInput(kind, input);
    await this.scopes.assertResourceAccess(actor, scope);
    return this.prisma.$transaction(async (tx) => {
      let row: { id: string };
      if (kind === 'year')
        row = await tx.academicYear.create({
          data: input as Prisma.AcademicYearUncheckedCreateInput,
        });
      else if (kind === 'semester')
        row = await tx.semester.create({ data: input as Prisma.SemesterUncheckedCreateInput });
      else if (kind === 'course')
        row = await tx.course.create({ data: input as Prisma.CourseUncheckedCreateInput });
      else if (kind === 'section')
        row = await tx.section.create({ data: input as Prisma.SectionUncheckedCreateInput });
      else
        row = await tx.contentCategory.create({
          data: input as Prisma.ContentCategoryUncheckedCreateInput,
        });
      await this.audit.record({
        actorId: actor.id,
        actionKey: 'catalog.create',
        entityType: kind,
        entityId: row.id,
        after: input,
        metadata,
        client: tx,
      });
      return row;
    });
  }

  async update(
    kind: 'year' | 'semester' | 'course' | 'section' | 'content-type',
    id: string,
    input: Record<string, unknown>,
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    const scope = await this.scopeForExisting(kind, id);
    await this.scopes.assertResourceAccess(actor, scope);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findExisting(kind, id, tx);
      let row: { id: string };
      if (kind === 'year') row = await tx.academicYear.update({ where: { id }, data: input });
      else if (kind === 'semester') row = await tx.semester.update({ where: { id }, data: input });
      else if (kind === 'course') row = await tx.course.update({ where: { id }, data: input });
      else if (kind === 'section') row = await tx.section.update({ where: { id }, data: input });
      else row = await tx.contentCategory.update({ where: { id }, data: input });
      await this.audit.record({
        actorId: actor.id,
        actionKey: input.displayOrder === undefined ? 'catalog.update' : 'catalog.reorder',
        entityType: kind,
        entityId: id,
        before,
        after: row,
        metadata,
        client: tx,
      });
      return row;
    });
  }

  async archive(
    kind: 'year' | 'semester' | 'course' | 'section' | 'content-type',
    id: string,
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    return this.update(kind, id, { isActive: false, archivedAt: new Date() }, actor, metadata);
  }

  async restore(
    kind: 'year' | 'semester' | 'course' | 'section' | 'content-type',
    id: string,
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    return this.update(kind, id, { isActive: true, archivedAt: null }, actor, metadata);
  }

  async delete(
    kind: 'year' | 'semester' | 'course' | 'section' | 'content-type',
    id: string,
    actor: Actor,
    metadata: RequestMetadata,
  ) {
    const scope = await this.scopeForExisting(kind, id);
    await this.scopes.assertResourceAccess(actor, scope);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findExisting(kind, id, tx);
      if (before.isActive) throw new BadRequestException('يجب أرشفة العنصر قبل حذفه نهائيًا.');
      try {
        if (kind === 'year') await tx.academicYear.delete({ where: { id } });
        else if (kind === 'semester') await tx.semester.delete({ where: { id } });
        else if (kind === 'course') await tx.course.delete({ where: { id } });
        else if (kind === 'section') await tx.section.delete({ where: { id } });
        else await tx.contentCategory.delete({ where: { id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
          throw new BadRequestException(
            'لا يمكن حذف العنصر لأنه مرتبط بعناصر أو محتوى آخر. احذف الارتباطات أولًا.',
          );
        throw error;
      }
      await this.audit.record({
        actorId: actor.id,
        actionKey: 'catalog.delete',
        entityType: kind,
        entityId: id,
        before,
        metadata,
        client: tx,
      });
      return { deleted: true };
    });
  }
  private async mainBot() {
    const bot = await this.prisma.bot.findUnique({
      where: { key: 'medical-main' },
      select: { id: true },
    });
    if (!bot) throw new NotFoundException('Main bot is not configured');
    return bot;
  }

  private async scopeForInput(kind: string, input: Record<string, unknown>) {
    const bot = await this.mainBot();
    if (kind === 'year') return { botId: bot.id, academicYearId: undefined };
    if (kind === 'semester') return { botId: bot.id, academicYearId: String(input.academicYearId) };
    if (kind === 'course') {
      const semester = await this.prisma.semester.findUnique({
        where: { id: String(input.semesterId) },
        select: { academicYearId: true },
      });
      if (!semester) throw new NotFoundException('Semester not found');
      return { botId: bot.id, academicYearId: semester.academicYearId };
    }
    if (kind === 'content-type') {
      const section = await this.prisma.section.findUnique({
        where: { id: String(input.sectionId) },
        select: {
          courseId: true,
          course: { select: { semester: { select: { academicYearId: true } } } },
        },
      });
      if (!section) throw new NotFoundException('Section not found');
      return {
        botId: bot.id,
        academicYearId: section.course.semester.academicYearId,
        courseId: section.courseId,
      };
    }
    const course = await this.prisma.course.findUnique({
      where: { id: String(input.courseId) },
      select: { id: true, semester: { select: { academicYearId: true } } },
    });
    if (!course) throw new NotFoundException('Course not found');
    return { botId: bot.id, academicYearId: course.semester.academicYearId, courseId: course.id };
  }

  private async scopeForExisting(kind: string, id: string) {
    if (kind === 'year') return this.scopeForInput('semester', { academicYearId: id });
    if (kind === 'semester') {
      const row = await this.prisma.semester.findUnique({
        where: { id },
        select: { academicYearId: true },
      });
      if (!row) throw new NotFoundException('Semester not found');
      return this.scopeForInput('semester', row);
    }
    if (kind === 'course') {
      const row = await this.prisma.course.findUnique({
        where: { id },
        select: { semesterId: true },
      });
      if (!row) throw new NotFoundException('Course not found');
      return this.scopeForInput('course', row);
    }
    if (kind === 'section') {
      const row = await this.prisma.section.findUnique({
        where: { id },
        select: { courseId: true },
      });
      if (!row) throw new NotFoundException('Section not found');
      return this.scopeForInput('section', row);
    }
    const row = await this.prisma.contentCategory.findUnique({
      where: { id },
      select: { sectionId: true },
    });
    if (!row) throw new NotFoundException('Content category not found');
    return this.scopeForInput('content-type', row);
  }

  private async findExisting(kind: string, id: string, tx: Prisma.TransactionClient) {
    if (kind === 'year') return tx.academicYear.findUniqueOrThrow({ where: { id } });
    if (kind === 'semester') return tx.semester.findUniqueOrThrow({ where: { id } });
    if (kind === 'course') return tx.course.findUniqueOrThrow({ where: { id } });
    if (kind === 'section') return tx.section.findUniqueOrThrow({ where: { id } });
    return tx.contentCategory.findUniqueOrThrow({ where: { id } });
  }
}
