import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../app/(protected)/bot-users/page';
import DetailPage from '../app/(protected)/bot-users/[id]/page';
import { getCurrentAdmin, serverApi } from '../src/lib/server-api';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('redirect');
  },
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('../src/lib/server-api', () => ({
  getCurrentAdmin: vi.fn(),
  serverApi: vi.fn(),
  ServerApiError: class extends Error {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentAdmin).mockResolvedValue({ roleKeys: ['super-admin'] } as never);
});

describe('bot users pages', () => {
  it('blocks secondary admins on both pages before fetching private user data', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ roleKeys: ['content-admin'] } as never);
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect');
    await expect(
      DetailPage({ params: Promise.resolve({ id: 's1' }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('redirect');
    expect(serverApi).not.toHaveBeenCalled();
  });

  it('renders user activity and preserves date filters in pagination and detail links', async () => {
    vi.mocked(serverApi).mockResolvedValue({
      total: 30,
      page: 1,
      pageSize: 25,
      summary: { sessions: 3, interactions: 10, contentUses: 4, activeToday: 2, activeWeek: 5 },
      items: [
        {
          id: 's1',
          telegramUserId: '42',
          username: 'student',
          firstName: 'Student',
          lastName: null,
          firstSeenAt: '2026-10-01T10:00:00Z',
          lastSeenAt: '2026-10-17T10:00:00Z',
          selectedAcademicYear: null,
          sessions: 3,
          starts: 2,
          interactions: 10,
          contentUses: [{ type: 'DOWNLOAD_REQUEST', count: 4 }],
        },
      ],
    });
    const html = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ from: '2026-10-01', to: '2026-10-17', search: 'Student' }),
      }),
    );
    expect(html).toContain('Student');
    expect(html).toContain('@student');
    expect(html).toContain('/bot-users/s1?from=2026-10-01');
    expect(html).toContain('page=2');
    expect(html).toContain('طلب ملف');
  });

  it('shows a useful empty state for a new bot', async () => {
    vi.mocked(serverApi).mockResolvedValue({
      total: 0,
      page: 1,
      pageSize: 25,
      items: [],
      summary: { sessions: 0, interactions: 0, contentUses: 0, activeToday: 0, activeWeek: 0 },
    });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('لا يوجد مستخدمون مطابقون للفلاتر.');
  });
});
