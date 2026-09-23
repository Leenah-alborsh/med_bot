import { describe, expect, it, vi } from 'vitest';
import { AnnouncementsService } from '../src/announcements/announcements.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { TelegramWebhookService } from '../src/telegram/telegram-webhook.service.js';
import type { AuditService } from '../src/audit/audit.service.js';

const actor = { id: 'admin', permissions: ['announcements.send'], roleKeys: [] } as never;

describe('announcements', () => {
  it('queues an announcement for unique selected years', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ id: 'announcement', status: 'QUEUED', photoFileId: null });
    const prisma = {
      bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot', welcomePhotoFileId: null }) },
      academicYear: { count: vi.fn().mockResolvedValue(2) },
      announcement: { create, findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
    const service = new AnnouncementsService(prisma, {} as TelegramWebhookService, audit);
    await service.create(
      {
        message: 'إعلان',
        yearIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
          '11111111-1111-4111-8111-111111111111',
        ],
        useWelcomePhoto: false,
      },
      actor,
      {},
    );
    const createInput = create.mock.calls[0]?.[0] as { data: { targetYearIds: string[] } };
    expect(createInput.data.targetYearIds).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('targets active bot users in the selected years and records delivery totals', async () => {
    const next = {
      id: 'announcement',
      botId: 'bot',
      message: 'إعلان',
      photoFileId: null,
      targetYearIds: ['year-1'],
      status: 'QUEUED',
    };
    const update = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([{ telegramUserId: 1n }, { telegramUserId: 2n }]);
    const prisma = {
      announcement: {
        findFirst: vi.fn().mockResolvedValue(next),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update,
      },
      student: { findMany },
    } as unknown as PrismaService;
    const sendAnnouncement = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('blocked'));
    const service = new AnnouncementsService(
      prisma,
      { sendAnnouncement } as unknown as TelegramWebhookService,
      {} as AuditService,
    );
    await (service as unknown as { processNext(): Promise<void> }).processNext();
    const studentQuery = findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(studentQuery.where).toEqual({
      isBlocked: false,
      selectedAcademicYearId: { in: ['year-1'] },
      memberships: { some: { botId: 'bot', isBlocked: false } },
    });
    const completed = update.mock.calls.at(-1)?.[0] as {
      where: { id: string };
      data: { status: string; sentCount: number; failedCount: number; completedAt: Date };
    };
    expect(completed.where).toEqual({ id: 'announcement' });
    expect(completed.data).toMatchObject({ status: 'COMPLETED', sentCount: 1, failedCount: 1 });
    expect(completed.data.completedAt).toBeInstanceOf(Date);
  });
});
