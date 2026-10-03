import { describe, expect, it, vi } from 'vitest';
import { UnifiedContentService } from '../src/content/unified-content.service.js';
import { listContentSchema } from '../src/content/content.schemas.js';
import { TelegramInboxService } from '../src/telegram/telegram-inbox.service.js';
import { ContentService } from '../src/content/content.service.js';
import { Prisma } from '@medical/database';

const actor = { id: 'admin', roleKeys: ['content-admin'] } as never;
const makeInbox = (id: string, overrides = {}) => ({
  id,
  fileName: `${id}.pdf`,
  mimeType: 'application/pdf',
  mediaType: 'document',
  fileSize: 1_900_000_000n,
  receivedAt: new Date('2026-10-01'),
  status: 'UNCLASSIFIED',
  contentItemId: null,
  attachmentId: null,
  ...overrides,
});

function setup(managedCount = 130, inboxRows = [makeInbox('incoming')]) {
  const managedRows = Array.from({ length: managedCount }, (_, index) => ({
    id: `managed-${index}`,
  }));
  const content = {
    list: vi.fn((query: { page: number; pageSize: number }) =>
      Promise.resolve({
        items: managedRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: managedRows.length,
        page: query.page,
        pageSize: query.pageSize,
      }),
    ),
  };
  const matchingInbox = () =>
    inboxRows.filter(
      (row) =>
        row.status === 'UNCLASSIFIED' && row.contentItemId === null && row.attachmentId === null,
    );
  const prisma = {
    telegramChannelFile: {
      count: vi.fn(() => Promise.resolve(matchingInbox().length)),
      findMany: vi.fn((query: { skip: number; take: number; where: unknown }) =>
        Promise.resolve(matchingInbox().slice(query.skip, query.skip + query.take)),
      ),
    },
  };
  const service = new UnifiedContentService(content as never, prisma as never);
  return { service, content, prisma, managedRows, inboxRows };
}

describe('Unified admin content', () => {
  it('keeps managed content accessible when the configured database lacks the inbox table', async () => {
    const { service, prisma } = setup();
    prisma.telegramChannelFile.count.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Missing table', {
        code: 'P2021',
        clientVersion: '6',
        meta: { table: 'public.TelegramChannelFile' },
      }),
    );
    const result = await service.list(listContentSchema.parse({ page: 5 }), actor);
    expect(result.inboxAvailable).toBe(false);
    expect(result.total).toBe(130);
    expect(result.items[0]?.unifiedId).toBe('managed_content:managed-100');
  });

  it('does not hide unrelated database failures', async () => {
    const { service, prisma } = setup();
    prisma.telegramChannelFile.count.mockRejectedValue(new Error('Connection unavailable'));
    await expect(service.list(listContentSchema.parse({}), actor)).rejects.toThrow(
      'Connection unavailable',
    );
  });
  it('keeps both sources distinct and serializes large file metadata safely', async () => {
    const { service, content, prisma } = setup();
    const result = await service.list(listContentSchema.parse({}), actor);
    expect(result.total).toBe(131);
    expect(result.items[0]).toMatchObject({
      source: 'telegram_inbox',
      unifiedId: 'telegram_inbox:incoming',
      needsClassification: true,
      section: null,
      state: null,
      fileSize: '1900000000',
    });
    expect(result.items[1]).toMatchObject({
      source: 'managed_content',
      unifiedId: 'managed_content:managed-0',
    });
    expect(content.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }), actor);
    expect(prisma.telegramChannelFile.count).toHaveBeenCalledWith({
      where: {
        status: 'UNCLASSIFIED',
        contentItemId: null,
        attachmentId: null,
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('reaches all managed rows beyond 100 without gaps or duplicates at source boundaries', async () => {
    const { service } = setup(
      130,
      Array.from({ length: 27 }, (_, i) => makeInbox(`inbox-${i}`)),
    );
    const ids: string[] = [];
    for (let page = 1; page <= 7; page += 1) {
      const result = await service.list(listContentSchema.parse({ page }), actor);
      ids.push(...result.items.map((item) => item.unifiedId));
      expect(result.items.length).toBe(page === 7 ? 7 : 25);
    }
    expect(ids).toHaveLength(157);
    expect(new Set(ids).size).toBe(157);
    expect(ids.at(-1)).toBe('managed_content:managed-129');
  });

  it('handles empty sources and pages beyond the total', async () => {
    for (const [managedCount, inboxCount] of [
      [0, 0],
      [0, 30],
      [30, 0],
    ] as const) {
      const { service } = setup(
        managedCount,
        Array.from({ length: inboxCount }, (_, i) => makeInbox(`inbox-${i}`)),
      );
      const result = await service.list(listContentSchema.parse({ page: 10 }), actor);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(managedCount + inboxCount);
    }
  });

  it.each(['yearId', 'semesterId', 'courseId', 'sectionId', 'contentCategoryId', 'state', 'type'])(
    'excludes unrelated inbox files when filtering by %s and delegates the filter',
    async (key) => {
      const { service, content, prisma } = setup();
      const value =
        key === 'state'
          ? 'DRAFT'
          : key === 'type'
            ? 'TEXT'
            : '11111111-1111-4111-8111-111111111111';
      const query = listContentSchema.parse({ [key]: value });
      const result = await service.list(query, actor);
      expect(result.total).toBe(130);
      expect(result.items.every((item) => item.source === 'managed_content')).toBe(true);
      expect(prisma.telegramChannelFile.count).not.toHaveBeenCalled();
      expect(content.list).toHaveBeenCalledWith(expect.objectContaining({ [key]: value }), actor);
    },
  );

  it('includes inbox files in FILE searches', async () => {
    const { service, prisma } = setup();
    await service.list(listContentSchema.parse({ type: 'FILE', search: 'incoming' }), actor);
    expect(prisma.telegramChannelFile.findMany.mock.calls[0]?.[0].where).toMatchObject({
      OR: [
        { fileName: { contains: 'incoming', mode: 'insensitive' } },
        { mimeType: { contains: 'incoming', mode: 'insensitive' } },
      ],
    });
  });

  it('excludes classified and partially linked inbox records, including after managed deletion', async () => {
    const { service } = setup(1, [
      makeInbox('unlinked'),
      makeInbox('classified', { status: 'CLASSIFIED' }),
      makeInbox('content-linked', { contentItemId: 'managed-0' }),
      makeInbox('attachment-linked', { attachmentId: 'attachment' }),
    ]);
    const result = await service.list(listContentSchema.parse({}), actor);
    expect(result.items.map((item) => item.unifiedId)).toEqual([
      'telegram_inbox:unlinked',
      'managed_content:managed-0',
    ]);
  });

  it('shows a classified file only as managed content on the next read', async () => {
    const { service, inboxRows, managedRows } = setup(0);
    const before = await service.list(listContentSchema.parse({}), actor);
    expect(before.items).toHaveLength(1);
    const tx = {
      telegramChannelFile: {
        updateMany: vi.fn(() => {
          Object.assign(inboxRows[0]!, { status: 'CLASSIFIED' });
          return Promise.resolve({ count: 1 });
        }),
        update: vi.fn(({ data }: { data: object }) =>
          Promise.resolve(Object.assign(inboxRows[0]!, data)),
        ),
      },
      section: { findFirst: vi.fn().mockResolvedValue({ id: 'section' }) },
      contentCategory: { findFirst: vi.fn().mockResolvedValue({ id: 'category', isActive: true }) },
      contentItem: {
        create: vi.fn(() => {
          managedRows.push({ id: 'classified-content' });
          return Promise.resolve({ id: 'classified-content', state: 'DRAFT' });
        }),
      },
      contentAttachment: { create: vi.fn().mockResolvedValue({ id: 'attachment' }) },
    };
    const classifier = new TelegramInboxService(
      {
        telegramChannelFile: {
          findUnique: vi.fn(() =>
            Promise.resolve({
              ...inboxRows[0],
              telegramFileId: 'file',
              telegramFileUniqueId: 'unique',
              storageChatId: -100n,
              storageMessageId: 1,
            }),
          ),
        },
        bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot' }) },
        course: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'course',
            hasSections: true,
            semester: { academicYearId: 'year' },
          }),
        },
        $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
          Promise.resolve(callback(tx)),
        ),
      } as never,
      { assertResourceAccess: vi.fn() } as never,
      { record: vi.fn() } as never,
    );
    await classifier.classify(
      'incoming',
      {
        courseId: 'course',
        sectionId: 'section',
        titleAr: 'Classified file',
        displayOrder: 0,
        publish: false,
      },
      actor,
      {},
    );
    const after = await service.list(listContentSchema.parse({}), actor);
    expect(after.total).toBe(1);
    expect(after.items).toEqual([
      expect.objectContaining({
        source: 'managed_content',
        unifiedId: 'managed_content:classified-content',
      }),
    ]);
  });
});

describe('Managed mutations remain on ContentService', () => {
  function setupManaged() {
    const before = { id: 'managed', state: 'DRAFT', publishedAt: null };
    const tx = {
      contentItem: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(before),
        update: vi.fn(({ data }: { data: object }) => Promise.resolve({ ...before, ...data })),
      },
    };
    const prisma = {
      contentItem: {
        findUnique: vi.fn().mockResolvedValue({
          contentType: 'TEXT',
          sectionId: 'section',
          contentCategoryId: 'category',
          section: {
            courseId: 'course',
            course: { semester: { id: 'semester', academicYearId: 'year' } },
          },
        }),
      },
      bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot' }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const audit = { record: vi.fn() };
    const service = new ContentService(
      prisma as never,
      { assertResourceAccess: vi.fn() } as never,
      audit as never,
      {} as never,
      {} as never,
    );
    return { service, tx, audit };
  }

  it('edits the original managed ID and retains auditing', async () => {
    const { service, tx, audit } = setupManaged();
    await service.update('managed', { titleAr: 'Updated' }, actor, {});
    expect(tx.contentItem.update).toHaveBeenCalledWith({
      where: { id: 'managed' },
      data: { titleAr: 'Updated', updatedById: 'admin' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: 'content.update', entityId: 'managed' }),
    );
  });

  it.each(['PUBLISHED', 'ARCHIVED', 'DRAFT'] as const)(
    'preserves %s transitions',
    async (state) => {
      const { service, tx } = setupManaged();
      await service.setState('managed', state, actor, {});
      expect(tx.contentItem.update.mock.calls[0]?.[0].data).toMatchObject({
        state,
        isActive: state !== 'ARCHIVED',
      });
    },
  );
});
