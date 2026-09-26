import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  brokenReportKeyboard,
  brokenReportSince,
  externalUrlKeyboard,
  parseCallbackData,
  publishedContentWhere,
} from '../src/bot/create-bot.js';
import {
  BACK_TEXT,
  HOME_TEXT,
  navigationKeyboard,
  previousLevel,
  resolveVisibleOption,
  stageKeyboard,
  visibleOptions,
} from '../src/bot/navigation.js';

describe('Telegram reply-keyboard navigation', () => {
  it('/start uses a persistent resized reply keyboard instead of inline navigation', () => {
    const keyboard = stageKeyboard();
    expect(keyboard).toMatchObject({ resize_keyboard: true, is_persistent: true });
    expect(keyboard.keyboard).toEqual([
      [{ text: 'السنوات الأولى–الثالثة' }],
      [{ text: 'السنوات الرابعة–السادسة' }],
    ]);
    expect(keyboard).not.toHaveProperty('inline_keyboard');
  });

  it('lays out short year, semester, course, category and content options two per row', () => {
    const keyboard = navigationKeyboard([
      { id: '1', label: 'الأول' },
      { id: '2', label: 'الثاني' },
    ]);
    expect(keyboard.keyboard[0]).toHaveLength(2);
    expect(keyboard.keyboard.at(-1)).toEqual([{ text: BACK_TEXT }, { text: HOME_TEXT }]);
  });

  it('puts long labels on their own rows and bounds Telegram labels', () => {
    const options = visibleOptions([
      { id: '1', label: 'x'.repeat(100) },
      { id: '2', label: 'قصير' },
    ]);
    expect(options[0]!.label.length).toBeLessThanOrEqual(60);
    expect(navigationKeyboard(options).keyboard.slice(0, 2)).toHaveLength(2);
  });

  it('resolves only a currently visible stage or child option', () => {
    const options = visibleOptions([{ id: 'year-1', label: 'السنة الأولى' }]);
    expect(resolveVisibleOption(options[0]!.label, options)?.id).toBe('year-1');
    expect(resolveVisibleOption('نص مكتوب', options)).toBeNull();
  });

  it('rejects stale keyboard values from a previous menu', () => {
    const current = visibleOptions([{ id: 'semester-1', label: 'الفصل الأول' }]);
    expect(resolveVisibleOption('السنة الأولى', current)).toBeNull();
  });

  it('disambiguates duplicate visible labels without guessing an entity', () => {
    const options = visibleOptions([
      { id: 'a', label: 'التشريح' },
      { id: 'b', label: 'التشريح' },
    ]);
    expect(options.map(({ label }) => label)).toEqual(['التشريح · 1', 'التشريح · 2']);
    expect(resolveVisibleOption('التشريح', options)).toBeNull();
  });

  it('moves back exactly one level and main-menu resets to stage', () => {
    expect(previousLevel('CONTENT')).toBe('CONTENT_CATEGORY');
    expect(previousLevel('CONTENT_CATEGORY')).toBe('COURSE');
    expect(previousLevel('COURSE')).toBe('SEMESTER');
    expect(previousLevel('SEMESTER')).toBe('YEAR');
    expect(previousLevel('YEAR')).toBe('STAGE');
    expect(HOME_TEXT).toContain('القائمة الرئيسية');
  });

  it('persists enough membership state to recover after a worker restart', () => {
    const schema = readFileSync(
      new URL('../../../packages/database/prisma/schema.prisma', import.meta.url),
      'utf8',
    );
    for (const field of [
      'navigationLevel',
      'navigationStage',
      'navigationYearId',
      'navigationSemesterId',
      'navigationCourseId',
      'navigationSectionId',
      'navigationContentType',
      'navigationContentCategoryId',
    ]) {
      expect(schema).toContain(field);
    }
  });

  it('keeps URL and broken-report actions as inline keyboards', () => {
    expect(externalUrlKeyboard('https://example.com')).toHaveProperty('inline_keyboard');
    expect(brokenReportKeyboard('11111111-1111-4111-8111-111111111111')).toHaveProperty(
      'inline_keyboard',
    );
    expect(parseCallbackData('report:11111111-1111-4111-8111-111111111111')).toMatchObject({
      action: 'report',
    });
    expect(parseCallbackData('section:11111111-1111-4111-8111-111111111111:0')).toBeNull();
  });

  it('queries only active published content and retains report cooldown', () => {
    expect(publishedContentWhere('section')).toEqual({
      sectionId: 'section',
      state: 'PUBLISHED',
      isActive: true,
      archivedAt: null,
    });
    expect(brokenReportSince(Date.UTC(2026, 0, 2)).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
