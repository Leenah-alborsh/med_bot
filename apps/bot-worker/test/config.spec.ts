import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('starts disabled without Telegram tokens', () => {
    expect(loadConfig({})).toMatchObject({
      BOT_WORKER_ENABLED: false,
      NODE_ENV: 'development',
    });
  });

  it('accepts enabled worker with a single token', () => {
    expect(
      loadConfig({
        BOT_WORKER_ENABLED: 'true',
        MEDICAL_BOT_TOKEN: 'placeholder-token',
        TELEGRAM_API_ROOT: 'med-bot-telegram-api:10000',
      }),
    ).toMatchObject({
      BOT_WORKER_ENABLED: true,
      MEDICAL_BOT_TOKEN: 'placeholder-token',
      TELEGRAM_API_ROOT: 'http://med-bot-telegram-api:10000',
    });
  });
});
