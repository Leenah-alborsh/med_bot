import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import Page from '../app/(protected)/content-types/page';
import { serverApi } from '../src/lib/server-api';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../src/lib/server-api', () => ({ serverApi: vi.fn() }));

it('renders chemistry and communications content types saved after row 100', async () => {
  const categories = Array.from({ length: 158 }, (_, index) => ({
    id: `type-${index}`,
    nameAr:
      index === 112
        ? 'Communication category'
        : index === 129
          ? 'Chemistry category'
          : `Category ${index}`,
    nameEn: `Category ${index}`,
    displayOrder: index,
    isActive: true,
    sectionId: `section-${index}`,
    courseId: `course-${index}`,
  }));
  vi.mocked(serverApi).mockImplementation((path) => {
    const url = new URL(path, 'https://example.com');
    const page = Number(url.searchParams.get('page'));
    const all = url.pathname === '/catalog/content-types' ? categories : [];
    return Promise.resolve({
      items: all.slice((page - 1) * 100, page * 100),
      total: all.length,
      page,
      pageSize: 100,
    });
  });
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('Communication category');
  expect(html).toContain('Chemistry category');
  expect(html).toContain('Category 157');
});
