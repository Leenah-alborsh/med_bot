import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/prisma/prisma.service.js', () => ({ PrismaService: class {} }));
import {
  ContributionsService,
  monthBounds,
  workActions,
} from '../src/audit/contributions.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

const actor = { roleKeys: ['super-admin'] } as AuthenticatedAdmin;
function setup() {
  const prisma = {
    adminUser: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'a', displayNameAr: 'أحمد', email: 'a@example.com' },
        { id: 'b', displayNameAr: 'سارة', email: 'b@example.com' },
      ]),
    },
    contentAttachment: {
      groupBy: vi.fn().mockResolvedValue([
        { uploadedById: 'a', _count: { _all: 3 } },
        { uploadedById: 'b', _count: { _all: 1 } },
        { uploadedById: null, _count: { _all: 2 } },
      ]),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: {
      groupBy: vi.fn().mockResolvedValue([
        {
          actorId: 'a',
          actionKey: 'content.create',
          _count: { _all: 2 },
          _max: { createdAt: new Date('2026-11-03T10:00:00Z') },
        },
      ]),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return { prisma, service: new ContributionsService(prisma as unknown as PrismaService) };
}
describe('monthly admin contributions', () => {
  it('rejects non-super-admins before any database access', async () => {
    const { service, prisma } = setup();
    await expect(
      service.report({ roleKeys: ['editor'] } as AuthenticatedAdmin, '2026-11'),
    ).rejects.toThrow('Super Admin only');
    expect(prisma.adminUser.findMany).not.toHaveBeenCalled();
  });
  it('uses Palestine month boundaries, including summer and year rollover', () => {
    expect(monthBounds('2026-11')).toEqual({
      gte: new Date('2026-10-31T22:00:00Z'),
      lt: new Date('2026-11-30T22:00:00Z'),
    });
    expect(monthBounds('2026-07').gte.toISOString()).toBe('2026-06-30T21:00:00.000Z');
    expect(monthBounds('2026-12').lt.toISOString()).toBe('2026-12-31T22:00:00.000Z');
  });
  it('excludes unattributed files from percentages and keeps activity separate', async () => {
    const { service, prisma } = setup();
    const report = await service.report(actor, '2026-11', 'a', 2);
    expect(report.totalUploads).toBe(4);
    expect(report.unattributedUploads).toBe(2);
    expect(report.items.map((row) => row.percentage)).toEqual([75, 25]);
    expect(report.items[0]!.totalActions).toBe(2);
    const fileCalls = prisma.contentAttachment.findMany.mock.calls as unknown as Array<
      [{ skip: number; take: number; where: { uploadedById: string; storageProvider: string } }]
    >;
    expect(fileCalls[0]?.[0].skip).toBe(20);
    expect(fileCalls[0]?.[0].take).toBe(20);
    expect(fileCalls[0]?.[0].where.uploadedById).toBe('a');
    expect(fileCalls[0]?.[0].where.storageProvider).toBe('TELEGRAM');
    expect(workActions).not.toContain('auth.login.success');
  });
  it('returns zero percentages for a month without uploads', async () => {
    const { service, prisma } = setup();
    prisma.contentAttachment.groupBy.mockResolvedValue([]);
    const report = await service.report(actor, '2026-11');
    expect(report.items.every((row) => row.percentage === 0)).toBe(true);
  });
});
