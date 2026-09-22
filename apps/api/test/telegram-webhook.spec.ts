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
  const service = new TelegramWebhookService(config as never, prisma as never);
  const bot = { handleUpdate: vi.fn() };
  Reflect.set(service, 'bot', bot);
  return { service, prisma, bot };
}

describe('TelegramWebhookService', () => {
  it('compares the Telegram secret without accepting missing or mismatched values', () => {
    const { service } = createService();
    expect(service.isSecretValid()).toBe(false);
    expect(service.isSecretValid('wrong')).toBe(false);
    expect(service.isSecretValid(secret)).toBe(true);
  });

  it('processes a new update once and records completion', async () => {
    const { service, prisma, bot } = createService();
    prisma.telegramWebhookUpdate.create.mockResolvedValue({});
    prisma.telegramWebhookUpdate.update.mockResolvedValue({});
    bot.handleUpdate.mockResolvedValue(undefined);

    await expect(service.handleUpdate({ update_id: 42 })).resolves.toBe(false);
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
