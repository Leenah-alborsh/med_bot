import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../app/(protected)/contributions/page';
import { getCurrentAdmin, serverApi, ServerApiError } from '../src/lib/server-api';
vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('redirect');
  },
}));
vi.mock('../src/lib/server-api', () => ({
  getCurrentAdmin: vi.fn(),
  serverApi: vi.fn(),
  ServerApiError: class extends Error {
    constructor(public status: number) {
      super('API request failed');
    }
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentAdmin).mockResolvedValue({ roleKeys: ['super-admin'] } as never);
});
describe('contributions page API failures', () => {
  it('preserves the role check before querying private statistics', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ roleKeys: ['editor'] } as never);
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect');
    expect(serverApi).not.toHaveBeenCalled();
  });
  it.each([404, 403, 400, 500, 503])(
    'renders an actionable error for API status %s instead of crashing',
    async (status) => {
      vi.mocked(serverApi).mockRejectedValue(new ServerApiError(status));
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
      expect(html).toContain('تعذر تحميل التقرير');
      expect(html).toContain(String(status));
      expect(html).toContain('لم تُحمّل الإحصاءات');
      expect(html).not.toContain('<table');
      if (status === 404) expect(html).toContain('اكتمال نشر');
    },
  );
  it('handles a connection failure without inventing statistics', async () => {
    vi.mocked(serverApi).mockRejectedValue(new TypeError('fetch failed'));
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('تعذر تحميل التقرير');
    expect(html).not.toContain('<table');
  });
  it('does not swallow authentication redirect signals', async () => {
    vi.mocked(serverApi).mockRejectedValue(new Error('redirect'));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect');
  });
  it('renders a successful report including month, percentages and file links', async () => {
    vi.mocked(serverApi).mockResolvedValue({
      month: '2026-11',
      totalUploads: 1,
      unattributedUploads: 0,
      items: [
        {
          id: 'a',
          displayNameAr: 'مشرف',
          email: 'a@example.com',
          uploads: 1,
          percentage: 100,
          totalActions: 1,
          lastActivity: null,
          actions: [],
        },
      ],
      details: {
        page: 1,
        pageSize: 20,
        totalFiles: 1,
        files: [
          {
            id: 'f',
            originalFilename: 'lecture.pdf',
            contentItemId: 'c',
            createdAt: '2026-11-02T10:00:00Z',
            contentItem: { titleAr: 'محاضرة', state: 'PUBLISHED' },
          },
        ],
        events: [],
      },
    });
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ adminId: 'a' }) }),
    );
    expect(html).toContain('100%');
    expect(html).toContain('lecture.pdf');
    expect(html).toContain('/api/backend/content/c/attachments/f/open');
  });
});
