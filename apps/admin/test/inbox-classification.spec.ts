import { describe, expect, it, vi } from 'vitest';
import { clientApi } from '../src/lib/client-api';
import { inboxCategories, inboxTargets } from '../src/lib/inbox-classification';

vi.mock('../src/lib/client-api', () => ({ clientApi: vi.fn() }));

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

  it('requests the selected category and includes eligible content beyond the first page', async () => {
    const signal = new AbortController().signal;
    const target = { id: 'file', titleAr: 'Reference', contentCategoryId: 'notes', state: 'DRAFT' };
    const request = vi.mocked(clientApi);
    request
      .mockResolvedValueOnce({
        items: [{ ...target, id: 'archived', state: 'ARCHIVED' }],
        pageSize: 100,
        total: 101,
      })
      .mockResolvedValueOnce({ items: [target], pageSize: 100, total: 101 });

    await expect(inboxTargets('notes', signal)).resolves.toEqual([target]);
    expect(request.mock.calls).toEqual([
      ['content/upload-targets?contentCategoryId=notes&pageSize=100&page=1', { signal }],
      ['content/upload-targets?contentCategoryId=notes&pageSize=100&page=2', { signal }],
    ]);
  });
});
