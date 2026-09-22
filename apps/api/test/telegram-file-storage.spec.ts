import { describe, expect, it, vi } from 'vitest';
import { UploadTicketService } from '../src/content/upload-ticket.service.js';
import { TelegramFileStorageService } from '../src/content/telegram-file-storage.service.js';

const config = (values: Record<string, string | undefined>) => ({
  get: vi.fn((key: string) => values[key]),
});

describe('managed Telegram file storage', () => {
  it('issues a short-lived signed ticket bound to the admin and content item', () => {
    const service = new UploadTicketService(
      config({ ADMIN_UPLOAD_TOKEN_SECRET: 's'.repeat(48) }) as never,
    );
    const actor = { id: 'admin-1', roleKeys: ['ADMIN'], permissions: [] } as never;
    const issued = service.issue('content-1', actor);
    expect(issued.expiresInSeconds).toBe(300);
    expect(service.verify(issued.ticket, 'content-1')).toEqual({
      id: 'admin-1',
      roleKeys: ['ADMIN'],
    });
    expect(() => service.verify(issued.ticket, 'content-2')).toThrow();
    expect(() => service.verify(`${issued.ticket}x`, 'content-1')).toThrow();
  });

  it('captures Telegram storage metadata and can remove an orphaned message', async () => {
    const service = new TelegramFileStorageService(
      config({ MEDICAL_BOT_TOKEN: 'token', TELEGRAM_FILE_CHANNEL_ID: '-1001234567890' }) as never,
    );
    const api = {
      sendDocument: vi.fn().mockResolvedValue({
        message_id: 73,
        chat: { id: -1001234567890 },
        document: { file_id: 'telegram-file-id', file_unique_id: 'unique-file-id' },
      }),
      deleteMessage: vi.fn().mockResolvedValue(true),
    };
    Reflect.set(service, 'api', api);
    const stored = await service.store('package.json', 'lecture.pdf', 'application/pdf');
    expect(stored).toEqual({
      storageChatId: -1001234567890n,
      storageMessageId: 73,
      telegramFileId: 'telegram-file-id',
      telegramFileUniqueId: 'unique-file-id',
    });
    await service.compensate(stored);
    expect(api.deleteMessage).toHaveBeenCalledWith('-1001234567890', 73);
  });

  it('fails clearly when the storage channel is not configured', async () => {
    const service = new TelegramFileStorageService(config({ MEDICAL_BOT_TOKEN: 'token' }) as never);
    await expect(service.store('file.pdf', 'file.pdf', 'application/pdf')).rejects.toThrow(
      'مستودع الملفات غير مهيأ',
    );
  });
});
