import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BotUsersService } from '../src/statistics/bot-users.service.js';
import { botUsersQuerySchema, usageDateRange } from '../src/statistics/bot-users.schemas.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

const actor = { roleKeys: ['super-admin'] } as AuthenticatedAdmin;
const query = botUsersQuerySchema.parse({});
function setup() {
  const prisma = {
    student: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    botUsageEvent: {
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    contentAccessEvent: {
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    studentBotMembership: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new BotUsersService(prisma as never) };
}

describe('super-admin bot user analytics', () => {
  it('rejects other admins before querying personal data, even with statistics permission', async () => {
    const { service, prisma } = setup();
    const secondary = {
      roleKeys: ['content-admin'],
      permissions: ['students.stats.read'],
    } as AuthenticatedAdmin;
    await expect(service.list(secondary, query)).rejects.toThrow(ForbiddenException);
    await expect(service.detail(secondary, 'student', query)).rejects.toThrow(ForbiddenException);
    expect(prisma.student.count).not.toHaveBeenCalled();
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('handles empty results without issuing unbounded aggregation queries', async () => {
    const { service, prisma } = setup();
    await expect(service.list(actor, query)).resolves.toMatchObject({
      total: 0,
      items: [],
      summary: { sessions: 0 },
    });
    expect(prisma.botUsageEvent.groupBy).not.toHaveBeenCalled();
  });

  it('returns serializable identities and correct per-user usage counts for the selected period', async () => {
    const { service, prisma } = setup();
    prisma.student.findMany.mockResolvedValue([{ id: 's1', telegramUserId: 123456789123n }]);
    prisma.studentBotMembership.findMany.mockResolvedValue([{ id: 'm1', studentId: 's1' }]);
    prisma.botUsageEvent.groupBy.mockResolvedValue([
      { botMembershipId: 'm1', action: 'START', isSessionStart: true, _count: { _all: 2 } },
      { botMembershipId: 'm1', action: 'START', isSessionStart: false, _count: { _all: 1 } },
      { botMembershipId: 'm1', action: 'INTERACTION', isSessionStart: false, _count: { _all: 7 } },
    ]);
    prisma.contentAccessEvent.groupBy.mockResolvedValue([
      { studentId: 's1', eventType: 'DOWNLOAD_REQUEST', _count: { _all: 4 } },
    ]);
    const filters = botUsersQuerySchema.parse({
      from: '2026-10-01',
      to: '2026-10-17',
      page: '2',
      search: '123456789123',
    });
    const result = await service.list(actor, filters);
    expect(result.items[0]).toMatchObject({
      telegramUserId: '123456789123',
      sessions: 2,
      starts: 3,
      interactions: 10,
      contentUses: [{ type: 'DOWNLOAD_REQUEST', count: 4 }],
    });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ telegramUserId: 123456789123n }]) as unknown,
        }) as unknown,
      }),
    );
    expect(prisma.botUsageEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-10-01T00:00:00Z'),
            lt: new Date('2026-10-18T00:00:00Z'),
          },
          botMembership: { studentId: { in: ['s1'] } },
        },
      }),
    );
  });

  it('returns 404 for unknown users', async () => {
    const { service } = setup();
    await expect(service.detail(actor, 'missing', query)).rejects.toThrow(NotFoundException);
  });

  it('limits content history to one page and interaction history to 25 records', async () => {
    const { service, prisma } = setup();
    prisma.student.findUnique.mockResolvedValue({ id: 's1', telegramUserId: 42n });
    const result = await service.detail(actor, 's1', { ...query, page: 2 });
    expect(result.student.telegramUserId).toBe('42');
    expect(prisma.contentAccessEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's1', createdAt: {} }, take: 25, skip: 25 }),
    );
    expect(prisma.botUsageEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });
});

describe('usage filters', () => {
  it.each([
    { page: 0 },
    { pageSize: 101 },
    { from: '2026-02-30' },
    { from: '2026-11-01', to: '2026-10-17' },
    { search: 'x'.repeat(101) },
  ])('rejects invalid filter %j', (value) => {
    expect(botUsersQuerySchema.safeParse(value).success).toBe(false);
  });
  it('includes the full final day', () => {
    expect(usageDateRange({ ...query, to: '2026-10-17' })).toEqual({
      lt: new Date('2026-10-18T00:00:00Z'),
    });
  });
});
