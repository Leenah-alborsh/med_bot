import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUploadConfig } from '../src/lib/server-upload-config';
import { ServerApiError, serverApi } from '../src/lib/server-api';

vi.mock('../src/lib/server-api', () => ({
  serverApi: vi.fn(),
  ServerApiError: class extends Error {
    constructor(public readonly status: number) {
      super('API request failed');
    }
  },
}));

describe('rolling deployment upload configuration', () => {
  beforeEach(() => {
    vi.mocked(serverApi).mockReset();
  });
  it('uses the configured limit when available', async () => {
    vi.mocked(serverApi).mockResolvedValue({ maxUploadBytes: 2_000_000_000 });
    expect(await getUploadConfig()).toEqual({ maxUploadBytes: 2_000_000_000 });
    expect(serverApi).toHaveBeenCalledWith('content/upload-config/dashboard');
  });
  it('retains the cloud limit while the previous API is deployed', async () => {
    vi.mocked(serverApi).mockRejectedValue(new ServerApiError(404));
    expect(await getUploadConfig()).toEqual({ maxUploadBytes: 50_000_000 });
  });
  it.each([401, 403, 500])('does not hide authentication or server errors (%s)', async (status) => {
    const error = new ServerApiError(status);
    vi.mocked(serverApi).mockRejectedValue(error);
    await expect(getUploadConfig()).rejects.toBe(error);
  });
});
