import { describe, expect, it } from 'vitest';
import { directUploadBaseUrl, uploadEndpoint } from '../src/lib/direct-upload';
describe('runtime direct upload destination', () => {
  it('uses the server runtime base instead of a stale browser build value', () => {
    const base = directUploadBaseUrl({
      NODE_ENV: 'production',
      API_INTERNAL_BASE_URL: 'https://api.example/api',
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001/api',
    });
    expect(uploadEndpoint(base, 'content-upload/id', 'https:')).toBe(
      'https://api.example/api/v1/content-upload/id',
    );
  });
  it('supports an explicit public base when the server uses a private address', () => {
    expect(
      directUploadBaseUrl({
        NODE_ENV: 'production',
        API_PUBLIC_BASE_URL: 'https://public.example/api/',
        API_INTERNAL_BASE_URL: 'http://private:3001/api',
      }),
    ).toBe('https://public.example/api');
  });
  it('does not silently send production tickets to localhost or plain HTTP', () => {
    expect(() =>
      uploadEndpoint('http://localhost:3001/api', 'content-upload/id', 'https:'),
    ).toThrow('HTTPS');
    expect(() => uploadEndpoint('https://localhost/api', 'content-upload/id', 'https:')).toThrow(
      'HTTPS',
    );
    expect(directUploadBaseUrl({ NODE_ENV: 'production' })).toBeUndefined();
    expect(() => uploadEndpoint(undefined, 'content-upload/id', 'https:')).toThrow('غير مهيأ');
  });
  it('rejects embedded credentials and retains local development support', () => {
    expect(() =>
      uploadEndpoint('https://user:secret@example.com', 'content-upload/id', 'https:'),
    ).toThrow();
    expect(
      uploadEndpoint(
        directUploadBaseUrl({ NODE_ENV: 'development' }),
        'content-upload/id',
        'http:',
      ),
    ).toBe('http://localhost:3001/api/v1/content-upload/id');
  });
});
