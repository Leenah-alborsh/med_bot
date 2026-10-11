import { describe, expect, it } from 'vitest';
import {
  LOCAL_MAX_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  validateEnvironment,
} from '../src/config/environment.js';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://medical:password@localhost:5432/medical',
};

describe('API environment', () => {
  it('allows 2000 MB only with an explicitly configured local Bot API', () => {
    const local = {
      ...baseEnvironment,
      TELEGRAM_LOCAL_API_ENABLED: 'true',
      TELEGRAM_API_ROOT: 'http://127.0.0.1:8081',
    };
    expect(validateEnvironment(local).MAX_UPLOAD_BYTES).toBe(LOCAL_MAX_UPLOAD_BYTES);
    expect(validateEnvironment({ ...local, MAX_UPLOAD_BYTES: '100000000' }).MAX_UPLOAD_BYTES).toBe(
      100_000_000,
    );
    expect(() =>
      validateEnvironment({ ...local, MAX_UPLOAD_BYTES: LOCAL_MAX_UPLOAD_BYTES + 1 }),
    ).toThrow();
    expect(() => validateEnvironment({ ...local, TELEGRAM_API_ROOT: '' })).toThrow();
    expect(() =>
      validateEnvironment({ ...local, TELEGRAM_API_ROOT: 'https://api.telegram.org' }),
    ).toThrow();
    expect(() =>
      validateEnvironment({ ...local, TELEGRAM_API_ROOT: 'ftp://example.com' }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...local,
        TELEGRAM_LOCAL_API_ENABLED: 'false',
        MAX_UPLOAD_BYTES: '100000000',
      }),
    ).toThrow();
    expect(
      validateEnvironment({ ...baseEnvironment, TELEGRAM_API_ROOT: '' }).TELEGRAM_API_ROOT,
    ).toBeUndefined();
  });

  it('defaults the dashboard upload limit to the 50 MB Cloud Bot API limit', () => {
    expect(validateEnvironment(baseEnvironment).MAX_UPLOAD_BYTES).toBe(MAX_UPLOAD_BYTES);
  });

  it('accepts at most 50 MB for dashboard uploads', () => {
    expect(
      validateEnvironment({
        ...baseEnvironment,
        MAX_UPLOAD_BYTES: String(MAX_UPLOAD_BYTES),
      }).MAX_UPLOAD_BYTES,
    ).toBe(MAX_UPLOAD_BYTES);
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        MAX_UPLOAD_BYTES: String(MAX_UPLOAD_BYTES + 1),
      }),
    ).toThrow('Invalid API environment');
  });

  it('requires the trusted storage channel when webhook mode is enabled', () => {
    const webhook = {
      ...baseEnvironment,
      TELEGRAM_WEBHOOK_ENABLED: 'true',
      MEDICAL_BOT_TOKEN: 'token',
      TELEGRAM_WEBHOOK_SECRET: 's'.repeat(32),
      TELEGRAM_WEBHOOK_URL: 'https://example.com/api/v1/telegram/webhook',
    };
    expect(() => validateEnvironment(webhook)).toThrow('Invalid API environment');
    expect(
      validateEnvironment({ ...webhook, TELEGRAM_FILE_CHANNEL_ID: '-1001234567890' })
        .TELEGRAM_FILE_CHANNEL_ID,
    ).toBe('-1001234567890');
  });
});
