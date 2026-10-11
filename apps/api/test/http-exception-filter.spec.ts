import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayloadTooLargeException, type ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';

function captureError(exception: unknown) {
  const json = vi.fn<(payload: { error: { message: string } }) => void>();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/content-upload/test' }),
    }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  const payload = json.mock.calls[0]?.[0];
  if (!payload) throw new Error('Expected a JSON error response');
  return { status, error: payload.error };
}

describe('upload error messages', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('explains the cloud limit for raw Multer errors', () => {
    vi.stubEnv('TELEGRAM_LOCAL_API_ENABLED', 'false');
    vi.stubEnv('MAX_UPLOAD_BYTES', '50000000');
    const { status, error } = captureError(
      Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' }),
    );
    expect(status).toHaveBeenCalledWith(413);
    expect(error.message).toContain('50 ميجابايت');
    expect(error.message).toContain('الداشبورد');
  });

  it('explains the local limit after Nest converts the Multer error', () => {
    vi.stubEnv('TELEGRAM_LOCAL_API_ENABLED', 'true');
    vi.stubEnv('TELEGRAM_API_ROOT', 'http://127.0.0.1:8081');
    vi.stubEnv('MAX_UPLOAD_BYTES', '2000000000');
    const { status, error } = captureError(new PayloadTooLargeException('File too large'));
    expect(status).toHaveBeenCalledWith(413);
    expect(error.message).toContain('2000 ميجابايت');
  });

  it('does not expose internal error details', () => {
    const { status, error } = captureError(new Error('private credentials'));
    expect(status).toHaveBeenCalledWith(500);
    expect(error.message).toBe('Internal server error');
  });
});
