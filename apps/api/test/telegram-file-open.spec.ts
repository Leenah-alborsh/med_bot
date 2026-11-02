import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../src/config/environment.js';
const { getFile } = vi.hoisted(() => ({ getFile: vi.fn() }));
vi.mock('grammy', () => ({
  Api: class {
    getFile = getFile;
  },
  InputFile: class {},
}));
import { TelegramFileStorageService } from '../src/content/telegram-file-storage.service.js';
function storage() {
  const values: Record<string, unknown> = { MEDICAL_BOT_TOKEN: 'server-only-token' };
  const config = { get: (key: string) => values[key] };
  return new TelegramFileStorageService(config as unknown as ConfigService<Environment, true>);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('Telegram file streaming', () => {
  it('fetches through the server and returns bytes rather than a credential-bearing URL', async () => {
    getFile.mockResolvedValue({ file_path: 'documents/lecture.pdf' });
    const fetcher = vi.fn().mockResolvedValue(new Response('file contents'));
    vi.stubGlobal('fetch', fetcher);
    const body = await storage().open('file-id');
    expect(await new Response(body).text()).toBe('file contents');
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.telegram.org/file/botserver-only-token/documents/lecture.pdf',
      expect.objectContaining({ redirect: 'error' }),
    );
  });
  it('does not leak token-bearing upstream errors', async () => {
    getFile.mockRejectedValue(new Error('failed https://api.telegram.org/botserver-only-token'));
    try {
      await storage().open('file-id');
      throw new Error('expected failure');
    } catch (error) {
      expect(String(error)).not.toContain('server-only-token');
      expect(String(error)).toContain('تعذر فتح الملف');
    }
  });
  it('rejects absolute local paths and traversal instead of reading server files', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const path of ['/etc/passwd', '../private']) {
      getFile.mockResolvedValue({ file_path: path });
      await expect(storage().open('file-id')).rejects.toThrow('تعذر فتح الملف');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
