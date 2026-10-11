import { Prisma } from '@medical/database';
import { describe, expect, it, vi } from 'vitest';
import { TelegramWebhookService } from '../src/telegram/telegram-webhook.service.js';

const secret = 'a'.repeat(32);

function createService() {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'TELEGRAM_WEBHOOK_SECRET') return secret;
      return undefined;
    }),
  };
  const prisma = {
    telegramWebhookUpdate: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const inbox = { ingest: vi.fn().mockResolvedValue({ accepted: false }) };
  const service = new TelegramWebhookService(config as never, prisma as never, inbox as never);
  const bot = { api: { setMyProfilePhoto: vi.fn() }, handleUpdate: vi.fn() };
  Reflect.set(service, 'bot', bot);
  return { service, prisma, bot, inbox };
}

describe('TelegramWebhookService', () => {
  it('uploads a new static profile photo to Telegram', async () => {
    const { service, bot } = createService();
    bot.api.setMyProfilePhoto.mockResolvedValue(true);

    await service.setProfilePhoto({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      originalname: 'bot.jpg',
    } as Express.Multer.File);

    expect(bot.api.setMyProfilePhoto).toHaveBeenCalledOnce();
    expect(bot.api.setMyProfilePhoto.mock.calls[0]?.[0]).toMatchObject({ type: 'static' });
  });

  it('compares the Telegram secret without accepting missing or mismatched values', () => {
    const { service } = createService();
    expect(service.isSecretValid()).toBe(false);
    expect(service.isSecretValid('wrong')).toBe(false);
    expect(service.isSecretValid(secret)).toBe(true);
  });

  it('processes a new update once and records completion', async () => {
    const { service, prisma, bot, inbox } = createService();
    prisma.telegramWebhookUpdate.create.mockResolvedValue({});
    prisma.telegramWebhookUpdate.update.mockResolvedValue({});
    bot.handleUpdate.mockResolvedValue(undefined);

    await expect(service.handleUpdate({ update_id: 42 })).resolves.toBe(false);
    expect(inbox.ingest).toHaveBeenCalledOnce();
    expect(bot.handleUpdate).toHaveBeenCalledOnce();
    expect(prisma.telegramWebhookUpdate.update).toHaveBeenCalledOnce();
    const updateCall = prisma.telegramWebhookUpdate.update.mock.calls[0]?.[0] as {
      where: { updateId: bigint };
      data: { processedAt: unknown };
    };
    expect(updateCall.where).toEqual({ updateId: 42n });
    expect(updateCall.data.processedAt).toBeInstanceOf(Date);
  });

  it('acknowledges a duplicate update without processing it again', async () => {
    const { service, prisma, bot } = createService();
    prisma.telegramWebhookUpdate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(service.handleUpdate({ update_id: 42 })).resolves.toBe(true);
    expect(bot.handleUpdate).not.toHaveBeenCalled();
  });
});
