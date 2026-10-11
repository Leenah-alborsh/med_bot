import * as React from 'react';
import { createElement, type AnchorHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import {
  ContentManager,
  type ContentFilters,
  type UnifiedContentItem,
} from '../src/components/content-manager';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement('a', props, children),
}));

function render(filters: ContentFilters) {
  const item: UnifiedContentItem = {
    source: 'managed_content',
    unifiedId: 'managed_content:draft',
    id: 'draft',
    titleAr: 'Saved draft',
    sectionId: 'section',
    contentCategoryId: 'category',
    contentCategory: { nameAr: 'Category' },
    contentType: 'TEXT',
    state: 'DRAFT',
    displayOrder: 1,
    attachments: [],
    section: {
      nameAr: 'Section',
      course: {
        id: 'course',
        nameAr: 'Course',
        semester: { id: 'semester', academicYearId: 'year' },
      },
    },
  };
  return renderToStaticMarkup(
    createElement(ContentManager, {
      items: [item],
      total: 1,
      page: 1,
      pageSize: 25,
      filters,
      inboxAvailable: true,
      categories: [],
      sections: [],
      courses: [],
      semesters: [],
      years: [],
      maxUploadBytes: 50_000_000,
    }),
  );
}

it('renders persisted drafts and allows clearing the new-draft filters', () => {
  const html = render({ state: 'DRAFT', sectionId: 'section', search: 'Saved draft' });
  expect(html).toContain('Saved draft');
  expect(html).toContain('data-state="draft"');
  expect(html).toContain('aria-label="مسح الفلاتر"');
  expect(html).toContain('href="/content"');
  expect(render({})).not.toContain('aria-label="مسح الفلاتر"');
});
