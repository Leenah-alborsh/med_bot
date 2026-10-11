import * as React from 'react';
import { createElement, type AnchorHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportsTable, type Report } from '../src/components/reports-table';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement('a', props, children),
}));

function render(overrides: Partial<Report> = {}, canManage = true, canArchive = true) {
  const report: Report = {
    id: 'report',
    status: 'OPEN',
    createdAt: '2026-10-04',
    contentItem: {
      id: 'content',
      titleAr: 'File',
      state: 'PUBLISHED',
      _count: { attachments: 2 },
      section: { nameAr: 'Section', course: { id: 'course', nameAr: 'Course' } },
    },
    attachment: {
      originalFilename: 'file.pdf',
      isCurrent: true,
      previewUrl: 'https://t.me/c/123/42',
    },
    ...overrides,
  };
  return renderToStaticMarkup(
    createElement(ReportsTable, {
      reports: [report],
      canManage,
      canArchive,
      canReadContent: true,
    }),
  );
}

describe('report review and reversible archive controls', () => {
  it('opens the reported file and offers content management separately from review', () => {
    const markup = render();
    expect(markup).toContain('href="https://t.me/c/123/42"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('/content?courseId=course');
    expect(markup).toContain('تمت المراجعة بدون إخفاء المحتوى');
    expect(markup).toContain('أرشفة المحتوى من البوت مع إمكانية الاسترجاع');
  });
  it('does not fabricate preview links for files without a storage message', () => {
    const markup = render({
      attachment: { originalFilename: 'legacy.pdf', isCurrent: true, previewUrl: null },
    });
    expect(markup).toContain('legacy.pdf');
    expect(markup).not.toContain('https://t.me/');
    expect(markup).toContain('/content?courseId=course');
  });
  it('hides write actions from readers', () => {
    const markup = render({}, false, false);
    expect(markup).not.toContain('<button');
    expect(markup).toContain('فتح الملف');
  });
  it('disables archival for replaced attachments', () => {
    const markup = render({
      attachment: { originalFilename: 'old.pdf', isCurrent: false, previewUrl: null },
    });
    expect(markup).toContain('نسخة قديمة تم استبدالها');
    expect(markup).toMatch(
      /<button[^>]*aria-label="أرشفة المحتوى من البوت مع إمكانية الاسترجاع"[^>]*disabled=""/,
    );
  });
  it('renders legacy API reports without unsafe archival or broken course links', () => {
    const markup = render({
      contentItem: {
        id: 'content',
        titleAr: 'File',
        section: { nameAr: 'Section', course: { nameAr: 'Course' } },
      },
      attachment: { originalFilename: 'legacy.pdf' },
    });
    expect(markup).not.toContain('courseId=undefined');
    expect(markup).not.toContain('نسخة قديمة تم استبدالها');
    expect(markup).toMatch(
      /aria-label="أرشفة المحتوى من البوت مع إمكانية الاسترجاع"[^>]*disabled=""/,
    );
  });
});
