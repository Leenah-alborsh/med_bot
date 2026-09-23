import { describe, expect, it, vi } from 'vitest';
import { ContentService } from '../src/content/content.service.js';

describe('content deletion', () => {
  it('deletes dependent history atomically and ignores Telegram cleanup failure', async () => {
    const tx = {
      contentItem: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'content-1', state: 'ARCHIVED' }),
        delete: vi.fn().mockResolvedValue({ id: 'content-1' }),
      },
      brokenFileReport: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      contentAccessEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      contentItem: {
        findUnique: vi.fn().mockResolvedValue({
          sectionId: 'section-1',
          contentCategoryId: 'category-1',
          section: {
            courseId: 'course-1',
            course: { semester: { id: 'semester-1', academicYearId: 'year-1' } },
          },
        }),
      },
      contentAttachment: {
        findMany: vi.fn().mockResolvedValue([{ storageChatId: -100123n, storageMessageId: 42 }]),
      },
      bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot-1' }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const scopes = { assertResourceAccess: vi.fn().mockResolvedValue(undefined) };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const telegram = { remove: vi.fn().mockRejectedValue(new Error('message is already gone')) };
    const service = new ContentService(
      prisma as never,
      scopes as never,
      audit as never,
      telegram as never,
      {} as never,
    );

    await expect(
      service.delete('content-1', { id: 'admin-1', roleKeys: ['SUPER_ADMIN'] }, {}),
    ).resolves.toEqual({ deleted: true });
    expect(tx.brokenFileReport.deleteMany).toHaveBeenCalledWith({
      where: { contentItemId: 'content-1' },
    });
    expect(tx.contentAccessEvent.deleteMany).toHaveBeenCalledWith({
      where: { contentItemId: 'content-1' },
    });
    expect(tx.contentItem.delete).toHaveBeenCalledWith({ where: { id: 'content-1' } });
  });
});
