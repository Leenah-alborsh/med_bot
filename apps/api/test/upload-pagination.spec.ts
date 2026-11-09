import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('@medical/database', () => ({ Prisma: {} }));
import { ContentService } from '../src/content/content.service.js';
function setup() {
  const prisma = {
    contentItem: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(1000),
    },
  };
  const service = new ContentService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { prisma, service };
}
const actor = { id: 'a', roleKeys: ['super-admin'] };
describe('bounded upload target queries', () => {
  it('limits file-bearing queries in the database, not after loading every file', async () => {
    const { prisma, service } = setup();
    const result = await service.uploadTargets(actor, {
      page: 3,
      pageSize: 25,
      courseId: 'course',
      search: 'lecture',
    });
    const query = prisma.contentItem.findMany.mock.calls as unknown as Array<
      [{ skip: number; take: number; where: { AND: unknown[] } }]
    >;
    expect(query[0]?.[0].skip).toBe(50);
    expect(query[0]?.[0].take).toBe(25);
    expect(query[0]?.[0].where.AND).toContainEqual({ section: { courseId: 'course' } });
    expect(result.total).toBe(1000);
    expect(result.page).toBe(3);
  });
  it('keeps authorization in both paginated items and compact filter metadata', async () => {
    const { prisma, service } = setup();
    const scope = { section: { courseId: 'allowed' } };
    vi.spyOn(service as never, 'scopeWhere' as never).mockResolvedValue(scope);
    await service.uploadTargetOptions(actor);
    const queries = prisma.contentItem.findMany.mock.calls as unknown as Array<
      [{ where: { AND: unknown[] }; select: Record<string, unknown>; distinct: string[] }]
    >;
    expect(queries[0]?.[0].where.AND).toEqual([scope]);
    expect(queries[0]?.[0].distinct).toEqual(['contentCategoryId']);
    expect(queries[0]?.[0].select).not.toHaveProperty('attachments');
  });
});
