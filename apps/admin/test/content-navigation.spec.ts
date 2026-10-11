import { describe, expect, it } from 'vitest';
import { newDraftUrl } from '../src/lib/content-navigation';

describe('newly created draft navigation', () => {
  it('opens draft results on the first page in the saved section', () => {
    const url = new URL(
      newDraftUrl({ sectionId: 'saved-section', titleAr: 'ملخص القلب' }),
      'https://example.com',
    );
    expect(url.pathname).toBe('/content');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      state: 'DRAFT',
      sectionId: 'saved-section',
      search: 'ملخص القلب',
    });
    expect(url.searchParams.has('courseId')).toBe(false);
    expect(url.searchParams.has('type')).toBe(false);
  });
  it('keeps long titles within the API search limit', () => {
    expect(
      new URL(
        newDraftUrl({ sectionId: 'section', titleAr: 'A'.repeat(200) }),
        'https://example.com',
      ).searchParams.get('search'),
    ).toHaveLength(100);
  });
});
