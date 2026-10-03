import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, validateEnvironment } from '../src/config/environment.js';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://medical:password@localhost:5432/medical',
};

describe('API environment', () => {
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
