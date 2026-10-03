import { describe, expect, it, vi } from 'vitest';
import { ContentService } from '../src/content/content.service.js';

function setup(
  scopes: Array<{
    botId: string | null;
    academicYearId: string | null;
    courseId: string | null;
  }> = [],
) {
  const prisma = {
    adminScope: { findMany: vi.fn().mockResolvedValue(scopes) },
    bot: { findUnique: vi.fn().mockResolvedValue({ id: 'main-bot' }) },
    contentItem: {
      count: vi.fn().mockResolvedValue(152),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const service = new ContentService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}
const actor = { id: 'admin', roleKeys: ['viewer'] };
const query = { page: 5, pageSize: 25 };

describe('database content pagination and scope', () => {
  it('loads only the requested page and counts with identical scope and filters', async () => {
    const { service, prisma } = setup();
    const result = await service.list({ ...query, state: 'ARCHIVED', search: 'test' }, actor);
    expect(result).toMatchObject({ total: 152, page: 5, pageSize: 25 });
    const input = prisma.contentItem.findMany.mock.calls[0]![0] as unknown as { where: unknown };
    expect(prisma.contentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 25 }),
    );
    expect(prisma.contentItem.count).toHaveBeenCalledWith({ where: input.where });
    expect(input.where).toMatchObject({
      AND: [{}, { state: 'ARCHIVED', OR: expect.any(Array) as unknown }],
    });
    expect(prisma.adminScope.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not load scope or bot metadata for super admins', async () => {
    const { service, prisma } = setup();
    await service.list(query, { ...actor, roleKeys: ['super-admin'] });
    expect(prisma.adminScope.findMany).not.toHaveBeenCalled();
    expect(prisma.bot.findUnique).not.toHaveBeenCalled();
  });

  it('intersects combined year/course scopes and unions separate assignments', async () => {
    const { service, prisma } = setup([
      { botId: 'main-bot', academicYearId: 'year-a', courseId: 'course-a' },
      { botId: null, academicYearId: null, courseId: 'course-b' },
      { botId: 'different-bot', academicYearId: null, courseId: null },
    ]);
    await service.list({ ...query, courseId: 'selected-course' }, actor);
    expect(prisma.contentItem.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              {
                section: {
                  courseId: 'course-a',
                  course: { semester: { academicYearId: 'year-a' } },
                },
              },
              { section: { courseId: 'course-b' } },
            ],
          },
          { section: { courseId: 'selected-course' } },
        ],
      },
    });
  });

  it('denies scopes assigned exclusively to another bot', async () => {
    const { service, prisma } = setup([{ botId: 'other', academicYearId: null, courseId: null }]);
    await service.list(query, actor);
    expect(prisma.contentItem.count).toHaveBeenCalledWith({
      where: { AND: [{ id: { in: [] } }, {}] },
    });
  });

  it('checks scope afresh after assignments change instead of caching authorization', async () => {
    const { service, prisma } = setup();
    await service.list(query, actor);
    prisma.adminScope.findMany.mockResolvedValue([
      { botId: 'other', academicYearId: null, courseId: null },
    ]);
    await service.list(query, actor);
    expect(prisma.adminScope.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.contentItem.count).toHaveBeenLastCalledWith({
      where: { AND: [{ id: { in: [] } }, {}] },
    });
  });
});
