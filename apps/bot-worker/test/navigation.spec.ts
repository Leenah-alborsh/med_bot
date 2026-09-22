import { describe, expect, it } from 'vitest';
import {
  brokenReportSince,
  parseCallbackData,
  publishedContentWhere,
} from '../src/bot/create-bot.js';
describe('Telegram callback navigation', () => {
  it('accepts bounded structured callbacks', () => {
    expect(parseCallbackData('stage:1:0')).toEqual({ action: 'stage', id: '1', page: 0 });
    expect(parseCallbackData('section:11111111-1111-4111-8111-111111111111:12')).toMatchObject({
      action: 'section',
      page: 12,
    });
  });
  it('rejects malformed, stale, and oversized callbacks', () => {
    expect(parseCallbackData('not-valid')).toBeNull();
    expect(parseCallbackData('section:../../secret:0')).toBeNull();
    expect(parseCallbackData('section:11111111-1111-4111-8111-111111111111:9999')).toBeNull();
  });
  it('queries only active published content and uses a 24-hour report cooldown', () => {
    expect(publishedContentWhere('section')).toEqual({
      sectionId: 'section',
      state: 'PUBLISHED',
      isActive: true,
      archivedAt: null,
    });
    expect(brokenReportSince(Date.UTC(2026, 0, 2)).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
