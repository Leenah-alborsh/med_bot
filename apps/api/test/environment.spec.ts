import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, validateEnvironment } from '../src/config/environment.js';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://medical:password@localhost:5432/medical',
};

describe('API environment', () => {
  it('defaults the dashboard upload limit to 2000 MB', () => {
    expect(validateEnvironment(baseEnvironment).MAX_UPLOAD_BYTES).toBe(MAX_UPLOAD_BYTES);
  });

  it('accepts at most 2000 MB for dashboard uploads', () => {
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

  it('accepts an optional local Telegram Bot API root', () => {
    expect(
      validateEnvironment({
        ...baseEnvironment,
        TELEGRAM_API_ROOT: 'http://telegram-bot-api:8081',
      }).TELEGRAM_API_ROOT,
    ).toBe('http://telegram-bot-api:8081');
    expect(
      validateEnvironment({
        ...baseEnvironment,
        TELEGRAM_API_ROOT: 'med-bot-telegram-api:10000',
      }).TELEGRAM_API_ROOT,
    ).toBe('http://med-bot-telegram-api:10000');
  });
});
