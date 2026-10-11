import { describe, expect, it } from 'vitest';
import { inboxCategories } from '../src/lib/inbox-classification';

describe('existing inbox destinations', () => {
  const sections = [
    { id: 'section-a', nameAr: 'A', courseId: 'a' },
    { id: 'section-b', nameAr: 'B', courseId: 'b' },
  ];
  const categories = [
    { id: 'lectures', nameAr: 'Lectures', sectionId: 'section-a' },
    { id: 'notes', nameAr: 'Notes', sectionId: 'section-b' },
  ];
  it('only shows existing categories in the selected course and section', () => {
    expect(inboxCategories(categories, sections, 'a', 'section-a', true)).toEqual([categories[0]]);
    expect(inboxCategories(categories, sections, 'a', 'section-b', true)).toEqual([]);
    expect(inboxCategories(categories, sections, 'a', '', true)).toEqual([]);
  });
  it('supports the internal section of courses without visible sections', () => {
    expect(inboxCategories(categories, sections, 'b', '', false)).toEqual([categories[1]]);
    expect(inboxCategories(categories, sections, '', '', false)).toEqual([]);
  });
});
