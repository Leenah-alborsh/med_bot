import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TelegramInboxService } from '../src/telegram/telegram-inbox.service.js';

const channelId = '-1001234567890';
const channelPost = (overrides: Record<string, unknown> = {}) => ({
  update_id: 10,
  channel_post: {
    message_id: 77,
    date: 1_700_000_000,
    chat: { id: Number(channelId), type: 'channel' },
    document: {
      file_id: 'telegram-file-id',
      file_unique_id: 'telegram-unique-id',
      file_name: 'plan.pdf',
      mime_type: 'application/pdf',
      file_size: 1_900_000_000,
    },
    ...overrides,
  },
});

function ingestionService(
  saved: { id: string; attachmentId: string | null } = { id: 'inbox', attachmentId: null },
) {
  const tx = {
    telegramChannelFile: {
      upsert: vi.fn().mockResolvedValue(saved),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    contentAttachment: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: 'attachment' }),
    },
    contentItem: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const service = new TelegramInboxService(prisma as never, {} as never, {} as never);
  return { service, prisma, tx };
}

describe('Telegram Channel Inbox ingestion', () => {
  it('accepts files only from the configured storage channel', async () => {
    const { service, prisma, tx } = ingestionService();
    await expect(service.ingest(channelPost(), channelId)).resolves.toEqual({
      accepted: true,
      id: 'inbox',
    });
    const upsertInput = tx.telegramChannelFile.upsert.mock.calls[0]?.[0] as {
      where: {
        storageChatId_storageMessageId: { storageChatId: bigint; storageMessageId: number };
      };
      create: { telegramFileId: string; fileSize: bigint };
    };
    expect(upsertInput.where.storageChatId_storageMessageId).toEqual({
      storageChatId: BigInt(channelId),
      storageMessageId: 77,
    });
    expect(upsertInput.create).toMatchObject({
      telegramFileId: 'telegram-file-id',
      fileSize: 1_900_000_000n,
    });

    await expect(
      service.ingest(channelPost({ chat: { id: -1009999999999 } }), channelId),
    ).resolves.toEqual({ accepted: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('marks a dashboard-uploaded channel message as already classified', async () => {
    const { service, tx } = ingestionService();
    tx.contentAttachment.findFirst.mockResolvedValue({
      id: 'attachment',
      contentItemId: 'content',
      uploadedById: 'admin',
    });
    await service.ingest(channelPost(), channelId);
    const upsertInput = tx.telegramChannelFile.upsert.mock.calls[0]?.[0] as {
      create: { status: string; contentItemId: string; attachmentId: string };
    };
    expect(upsertInput.create).toMatchObject({
      status: 'CLASSIFIED',
      contentItemId: 'content',
      attachmentId: 'attachment',
    });
  });
  it('auto-classifies a channel file when the caption contains a valid link code', async () => {
    const { service, tx } = ingestionService({
      id: 'inbox',
      status: 'UNCLASSIFIED',
      contentItemId: null,
      attachmentId: null,
    } as never);
    tx.contentItem.findUnique.mockResolvedValue({
      id: 'content',
      contentType: 'FILE',
      createdById: 'admin',
      sourceInboxFile: null,
    });

    await service.ingest(channelPost({ caption: 'MED-ABCDEF1234' }), channelId);

    expect(tx.contentAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentItemId: 'content',
        storageProvider: 'TELEGRAM',
        storageMessageId: 77,
      }),
    });
    expect(tx.telegramChannelFile.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inbox',
        status: 'UNCLASSIFIED',
        contentItemId: null,
        attachmentId: null,
      },
      data: expect.objectContaining({
        status: 'CLASSIFIED',
        contentItemId: 'content',
      }),
    });
    expect(tx.telegramChannelFile.update).toHaveBeenCalledWith({
      where: { id: 'inbox' },
      data: { attachmentId: 'attachment' },
    });
  });

  it('keeps files with invalid or reused link codes in the manual inbox', async () => {
    const { service, tx } = ingestionService({
      id: 'inbox',
      status: 'UNCLASSIFIED',
      contentItemId: null,
      attachmentId: null,
    } as never);
    await service.ingest(channelPost({ caption: 'wrong-code' }), channelId);
    expect(tx.contentItem.findUnique).not.toHaveBeenCalled();

    tx.contentItem.findUnique.mockResolvedValue({
      id: 'content',
      contentType: 'FILE',
      createdById: 'admin',
      sourceInboxFile: { id: 'other-inbox' },
    });
    await service.ingest(channelPost({ message_id: 78, caption: 'MED-ABCDEF1234' }), channelId);
    expect(tx.contentAttachment.create).not.toHaveBeenCalled();
    expect(tx.telegramChannelFile.updateMany).not.toHaveBeenCalled();
  });
  it('uses an upsert key so repeated webhook deliveries cannot duplicate a message', async () => {
    const { service, tx } = ingestionService({
      id: 'inbox',
      status: 'UNCLASSIFIED',
      contentItemId: null,
      attachmentId: null,
    } as never);
    tx.contentItem.findUnique.mockResolvedValue({
      id: 'content',
      contentType: 'FILE',
      createdById: 'admin',
      sourceInboxFile: null,
    });
    await service.ingest(channelPost({ caption: 'MED-ABCDEF1234' }), channelId);
    tx.telegramChannelFile.upsert.mockResolvedValue({
      id: 'inbox',
      status: 'CLASSIFIED',
      contentItemId: 'content',
      attachmentId: 'attachment',
    });
    await service.ingest(channelPost({ caption: 'MED-ABCDEF1234' }), channelId);
    expect(tx.telegramChannelFile.upsert).toHaveBeenCalledTimes(2);
    const calls = tx.telegramChannelFile.upsert.mock.calls as Array<
      [
        {
          where: {
            storageChatId_storageMessageId: { storageChatId: bigint; storageMessageId: number };
          };
        },
      ]
    >;
    for (const [call] of calls) {
      expect(call.where.storageChatId_storageMessageId).toEqual({
        storageChatId: BigInt(channelId),
        storageMessageId: 77,
      });
    }
    expect(tx.contentAttachment.create).toHaveBeenCalledTimes(1);
  });

  it('does not move an existing link when an edited caption contains another content code', async () => {
    const { service, tx } = ingestionService({
      id: 'inbox',
      status: 'CLASSIFIED',
      contentItemId: 'original-content',
      attachmentId: 'attachment',
    } as never);
    tx.contentAttachment.findFirst.mockResolvedValue({
      id: 'attachment',
      contentItemId: 'original-content',
      uploadedById: 'admin',
    });

    await service.ingest(
      {
        update_id: 11,
        edited_channel_post: channelPost({ caption: 'MED-FFFFFFFFFF' }).channel_post,
      },
      channelId,
    );

    const upsert = tx.telegramChannelFile.upsert.mock.calls[0]?.[0] as {
      update: { contentItemId: string; attachmentId: string; linkCode: string };
    };
    expect(upsert.update).toMatchObject({
      contentItemId: 'original-content',
      attachmentId: 'attachment',
      linkCode: 'MED-FFFFFFFFFF',
    });
    expect(tx.contentItem.findUnique).not.toHaveBeenCalled();
    expect(tx.contentAttachment.create).not.toHaveBeenCalled();
    expect(tx.contentAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'attachment' } }),
    );
  });

  it('updates attachment metadata when an edited channel post was already classified', async () => {
    const { service, tx } = ingestionService({ id: 'inbox', attachmentId: 'attachment' });
    const update = {
      update_id: 11,
      edited_channel_post: channelPost().channel_post,
    };
    await service.ingest(update, channelId);
    const attachmentUpdate = tx.contentAttachment.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { telegramFileId: string; originalFilename: string; storageMessageId: number };
    };
    expect(attachmentUpdate).toMatchObject({
      where: { id: 'attachment' },
      data: {
        telegramFileId: 'telegram-file-id',
        originalFilename: 'plan.pdf',
        storageMessageId: 77,
      },
    });
  });
});

describe('Telegram Channel Inbox classification', () => {
  const inbox = {
    id: 'inbox',
    status: 'UNCLASSIFIED',
    fileName: 'large-plan.pdf',
    mimeType: 'application/pdf',
    fileSize: 1_900_000_000n,
    telegramFileId: 'file-id',
    telegramFileUniqueId: 'unique-id',
    storageChatId: BigInt(channelId),
    storageMessageId: 77,
  };
  const actor = {
    id: 'admin',
    roleKeys: ['content-admin'],
    permissions: ['content.create', 'content.publish'],
  } as never;
  const input = {
    courseId: '11111111-1111-4111-8111-111111111111',
    sectionId: '22222222-2222-4222-8222-222222222222',
    titleAr: 'الخطة',
    descriptionAr: 'خطة المادة',
    displayOrder: 3,
    publish: true,
  };

  function classificationService(assertResourceAccess = vi.fn().mockResolvedValue(undefined)) {
    const tx = {
      telegramChannelFile: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      section: { findFirst: vi.fn().mockResolvedValue({ id: input.sectionId }) },
      contentCategory: { findFirst: vi.fn().mockResolvedValue({ id: 'category', isActive: true }) },
      contentItem: {
        create: vi.fn().mockResolvedValue({ id: 'content', state: 'PUBLISHED' }),
      },
      contentAttachment: { create: vi.fn().mockResolvedValue({ id: 'attachment' }) },
    };
    const prisma = {
      telegramChannelFile: { findUnique: vi.fn().mockResolvedValue(inbox) },
      bot: { findUnique: vi.fn().mockResolvedValue({ id: 'bot' }) },
      course: {
        findFirst: vi.fn().mockResolvedValue({
          id: input.courseId,
          hasSections: true,
          semester: { academicYearId: 'year' },
        }),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: vi.fn().mockResolvedValue({}) };
    const service = new TelegramInboxService(
      prisma as never,
      { assertResourceAccess } as never,
      audit as never,
    );
    return { service, prisma, tx, audit, assertResourceAccess };
  }

  it('blocks classification outside the admin scope before creating content', async () => {
    const denied = vi.fn().mockRejectedValue(new ForbiddenException());
    const { service, prisma } = classificationService(denied);
    await expect(service.classify('inbox', input, actor, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('classifies and publishes by linking Telegram metadata without downloading the file', async () => {
    const { service, tx, assertResourceAccess } = classificationService();
    await expect(service.classify('inbox', input, actor, {})).resolves.toEqual({
      contentItemId: 'content',
      state: 'PUBLISHED',
    });
    expect(assertResourceAccess).toHaveBeenCalledWith(actor, {
      botId: 'bot',
      academicYearId: 'year',
      courseId: input.courseId,
    });
    const contentCreate = tx.contentItem.create.mock.calls[0]?.[0] as {
      data: { state: string; publishedAt: Date };
    };
    expect(contentCreate.data.state).toBe('PUBLISHED');
    expect(contentCreate.data.publishedAt).toBeInstanceOf(Date);
    const attachmentCreate = tx.contentAttachment.create.mock.calls[0]?.[0] as {
      data: { storageProvider: string; telegramFileId: string; fileSize: bigint };
    };
    expect(attachmentCreate.data).toMatchObject({
      storageProvider: 'TELEGRAM',
      telegramFileId: 'file-id',
      fileSize: 1_900_000_000n,
    });
  });
});
