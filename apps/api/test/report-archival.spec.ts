import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService, reportFilePreview } from '../src/reports/reports.service.js';
import { ReportsController } from '../src/reports/reports.controller.js';
import { PERMISSIONS_METADATA_KEY } from '../src/auth/permissions.decorator.js';
import { ContentService } from '../src/content/content.service.js';

function setup() {
  const content = {
    id: 'content',
    contentType: 'FILE',
    state: 'PUBLISHED',
    isActive: true,
    archivedAt: null as Date | null,
    updatedById: 'previous',
  };
  const report = {
    id: 'report',
    contentItemId: 'content',
    status: 'OPEN',
    resolutionNote: null as string | null,
    reviewedById: null as string | null,
    reviewedAt: null as Date | null,
  };
  const attachment = { isCurrent: true };
  const tx = {
    bot: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'bot' }) },
    contentItem: {
      findUniqueOrThrow: vi.fn(() => Promise.resolve({ ...content })),
      update: vi.fn((input: { data: Partial<typeof content> }) =>
        Promise.resolve(Object.assign(content, input.data)),
      ),
    },
    brokenFileReport: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          ...report,
          attachment,
          contentItem: {
            ...content,
            section: { courseId: 'course', course: { semester: { academicYearId: 'year' } } },
          },
        }),
      ),
      update: vi.fn((input: { data: Partial<typeof report> }) =>
        Promise.resolve(Object.assign(report, input.data)),
      ),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      const previousContent = { ...content },
        previousReport = { ...report };
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(content, previousContent);
        Object.assign(report, previousReport);
        throw error;
      }
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const scopes = { assertResourceAccess: vi.fn().mockResolvedValue(undefined) };
  const service = new ReportsService(prisma as never, audit as never, scopes as never);
  const actor = { id: 'admin', roleKeys: ['viewer'] } as never;
  return { service, actor, tx, prisma, audit, scopes, content, report, attachment };
}

describe('reversible report archival', () => {
  it('archives the content and resolves the report in one serializable transaction', async () => {
    const { service, actor, content, report, tx, prisma, audit, scopes } = setup();
    await service.archiveContent('report', actor, {});
    expect(content).toMatchObject({
      state: 'ARCHIVED',
      isActive: false,
      archivedAt: expect.any(Date) as unknown,
    });
    expect(report).toMatchObject({ status: 'RESOLVED', reviewedById: 'admin' });
    expect(tx.contentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          state: 'ARCHIVED',
          isActive: false,
          archivedAt: expect.any(Date) as unknown,
          updatedById: 'admin',
        },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(scopes.assertResourceAccess).toHaveBeenCalledWith(actor, {
      botId: 'bot',
      courseId: 'course',
      academicYearId: 'year',
    });
    expect(tx).not.toHaveProperty('contentAttachment');
  });

  it('leaves content published when a report is merely reviewed', async () => {
    const { service, actor, tx, content, report } = setup();
    await service.update('report', { status: 'REVIEWED' }, actor, {});
    expect(report.status).toBe('REVIEWED');
    expect(content.state).toBe('PUBLISHED');
    expect(tx.contentItem.update).not.toHaveBeenCalled();
  });

  it('checks scope before any content or report write', async () => {
    const { service, actor, tx, scopes } = setup();
    scopes.assertResourceAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.archiveContent('report', actor, {})).rejects.toThrow(ForbiddenException);
    expect(tx.contentItem.update).not.toHaveBeenCalled();
    expect(tx.brokenFileReport.update).not.toHaveBeenCalled();
  });

  it('refuses reports on replaced attachments', async () => {
    const { service, actor, attachment, tx } = setup();
    attachment.isCurrent = false;
    await expect(service.archiveContent('report', actor, {})).rejects.toThrow('نسخة قديمة');
    expect(tx.contentItem.update).not.toHaveBeenCalled();
  });

  it('refuses non-file content without touching it', async () => {
    const { service, actor, content, tx } = setup();
    content.contentType = 'TEXT';
    await expect(service.archiveContent('report', actor, {})).rejects.toThrow('المحتوى ليس ملفاً');
    expect(tx.contentItem.update).not.toHaveBeenCalled();
  });

  it('rolls back both state changes if recording the resolution fails', async () => {
    const { service, actor, content, report, audit } = setup();
    audit.record
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.archiveContent('report', actor, {})).rejects.toThrow('audit unavailable');
    expect(content.state).toBe('PUBLISHED');
    expect(report.status).toBe('OPEN');
  });

  it('does not overwrite a prior archival timestamp', async () => {
    const { service, actor, content, tx } = setup();
    content.state = 'ARCHIVED';
    content.isActive = false;
    content.archivedAt = new Date('2026-10-01');
    await service.archiveContent('report', actor, {});
    expect(tx.contentItem.update).not.toHaveBeenCalled();
    expect(content.archivedAt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('keeps a repeated archival resolution note idempotent', async () => {
    const { service, actor, report } = setup();
    await service.archiveContent('report', actor, {});
    const note = report.resolutionNote;
    await service.archiveContent('report', actor, {});
    expect(report.resolutionNote).toBe(note);
  });

  it('can restore content through the unchanged publication service', async () => {
    const { service, actor, prisma, audit, content, report } = setup();
    await service.archiveContent('report', actor, {});
    const managed = new ContentService(
      prisma as never,
      {} as never,
      audit as never,
      {} as never,
      {} as never,
    );
    Object.assign(managed, {
      contentTarget: vi.fn().mockResolvedValue({ courseId: 'course', academicYearId: 'year' }),
      assertScope: vi.fn().mockResolvedValue(undefined),
    });
    await managed.setState('content', 'PUBLISHED', actor, {});
    expect(content).toMatchObject({ state: 'PUBLISHED', isActive: true, archivedAt: null });
    expect(report.status).toBe('RESOLVED');
  });

  it('returns safe preview links without leaking storage identifiers or BigInt values', async () => {
    const attachment = {
      id: 'file',
      originalFilename: 'file.pdf',
      storageProvider: 'TELEGRAM',
      isCurrent: true,
      storageChatId: -1001234567890n,
      storageMessageId: 42,
    };
    const prisma = {
      brokenFileReport: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'report', attachment, student: { id: 'student', telegramUserId: 42n } },
          ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = new ReportsService(prisma as never, {} as never, {} as never);
    const result = await service.list(undefined, 1, 25);
    expect(result.items[0]?.attachment).toMatchObject({
      previewUrl: 'https://t.me/c/1234567890/42',
    });
    expect(result.items[0]?.attachment).not.toHaveProperty('storageChatId');
    expect(result.items[0]?.attachment).not.toHaveProperty('storageMessageId');
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('requires report management and the existing publication permission', () => {
    // Inspect metadata without invoking the controller method unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const method = ReportsController.prototype.archiveContent;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA_KEY, method)).toEqual([
      'broken-file-reports.manage',
      'content.publish',
    ]);
  });

  it('uses a Telegram message link without a bot token or download secret', () => {
    expect(reportFilePreview({ storageChatId: -1001234567890n, storageMessageId: 42 })).toBe(
      'https://t.me/c/1234567890/42',
    );
    expect(reportFilePreview({ storageChatId: null, storageMessageId: 42 })).toBeNull();
    expect(reportFilePreview({ storageChatId: 123n, storageMessageId: 42 })).toBeNull();
    expect(reportFilePreview({ storageChatId: -100123n, storageMessageId: null })).toBeNull();
  });
});
