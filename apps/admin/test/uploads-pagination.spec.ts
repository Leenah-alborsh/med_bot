import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import Page from '../app/(protected)/uploads/page';
import { serverApi, ServerApiError } from '../src/lib/server-api';
import { getUploadConfig } from '../src/lib/server-upload-config';
vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  redirect: () => {
    throw new Error('redirect');
  },
}));
vi.mock('../src/lib/server-api', () => ({
  serverApi: vi.fn(),
  ServerApiError: class extends Error {
    constructor(public status: number) {
      super();
    }
  },
}));
vi.mock('../src/lib/server-upload-config', () => ({
  getUploadConfig: vi.fn(),
}));
const item = (i: number) => ({
  id: `c-${i}`,
  titleAr: `Lecture ${i}`,
  sectionId: 'section',
  contentCategoryId: `category-${i}`,
  contentCategory: { nameAr: `Category ${i}` },
  section: {
    nameAr: 'Section',
    course: {
      id: 'course',
      nameAr: 'Course',
      semester: {
        id: 'semester',
        nameAr: 'Term',
        academicYearId: 'year',
        academicYear: { nameAr: 'Year' },
      },
    },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUploadConfig).mockResolvedValue({ maxUploadBytes: 50_000_000 });
});
it('renders only the selected 25 rows and keeps filter options beyond the current page', async () => {
  vi.mocked(serverApi).mockImplementation((path) =>
    Promise.resolve(
      path.includes('upload-target-options')
        ? { items: [item(999)] }
        : {
            items: Array.from({ length: 25 }, (_, i) => item(26 + i)),
            total: 1000,
            page: 2,
            pageSize: 25,
          },
    ),
  );
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ page: '2', courseId: 'course' }) }),
  );
  expect(html.match(/class="content-row"/g)).toHaveLength(25);
  expect(html).toContain('Lecture 26');
  expect(html).not.toContain('Lecture 1<');
  expect(html).toContain('Category 999');
  expect(html).toContain('page=3&amp;courseId=course');
});
it('keeps 25 rendered rows during a rolling deployment with the previous API', async () => {
  vi.mocked(serverApi).mockImplementation((path) =>
    path.includes('upload-target-options')
      ? Promise.reject(new ServerApiError(404))
      : Promise.resolve({ items: Array.from({ length: 1000 }, (_, i) => item(i + 1)) }),
  );
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: '2' }) }));
  expect(html.match(/class="content-row"/g)).toHaveLength(25);
  expect(html).toContain('Lecture 26');
  expect(html).toContain('1000');
});
it('does not hide API failures behind empty data', async () => {
  vi.mocked(serverApi).mockRejectedValue(new ServerApiError(500));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('تعذر تحميل صفحة الرفع');
  expect(html).toContain('HTTP 500');
  expect(html).not.toContain('class="content-row"');
});

it('shows the exact upload settings failure instead of crashing for an upload-only admin', async () => {
  vi.mocked(serverApi).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  vi.mocked(getUploadConfig).mockRejectedValue(new ServerApiError(403));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('إعدادات الرفع');
  expect(html).toContain('HTTP 403');
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('class="content-row"');
});
it('retains authentication redirects instead of replacing them with an upload error', async () => {
  vi.mocked(serverApi).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  vi.mocked(getUploadConfig).mockRejectedValue(new Error('redirect'));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect');
});
it('provides a retry screen for connection failures without leaking internal error messages', async () => {
  vi.mocked(serverApi).mockRejectedValue(new TypeError('private internal hostname unavailable'));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('تعذر تحميل صفحة الرفع');
  expect(html).toContain('href="/uploads"');
  expect(html).not.toContain('private internal hostname');
});
