'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileUp, Search, RotateCcw, UploadCloud } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { clientApi, clientUpload } from '../lib/client-api';
import { uploadTooLargeMessage } from '../lib/upload-limits';
import {
  changeUploadFilter,
  emptyUploadFilters,
  uploadFilterKeys,
  uploadFilterOptions,
  type UploadTarget,
  type UploadFilters,
} from '../lib/upload-target-filters';

export type { UploadTarget } from '../lib/upload-target-filters';

const filterLabels = {
  year: 'السنة الدراسية',
  semester: 'الفصل',
  course: 'المادة',
  section: 'القسم',
  category: 'نوع المحتوى',
};

export function AdminFileUploader({
  items,
  filterItems,
  total,
  page,
  pageSize,
  initialFilters,
  initialQuery,
  maxUploadBytes,
  uploadBaseUrl,
}: {
  items: UploadTarget[];
  filterItems: UploadTarget[];
  total: number;
  page: number;
  pageSize: number;
  initialFilters: UploadFilters;
  initialQuery: string;
  maxUploadBytes: number;
  uploadBaseUrl?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(initialFilters);
  const options = useMemo(
    () =>
      Object.fromEntries(
        uploadFilterKeys.map((key) => [key, uploadFilterOptions(filterItems, filters, key)]),
      ),
    [filterItems, filters],
  );
  const queryKeys = {
    year: 'yearId',
    semester: 'semesterId',
    course: 'courseId',
    section: 'sectionId',
    category: 'contentCategoryId',
  } as const;
  const pageUrl = (number: number) => {
    const params = new URLSearchParams({ page: String(number) });
    for (const key of uploadFilterKeys)
      if (initialFilters[key]) params.set(queryKeys[key], initialFilters[key]);
    if (initialQuery) params.set('search', initialQuery);
    return `/uploads?${params}`;
  };
  const hasFilters = Boolean(query || Object.values(filters).some(Boolean));

  async function upload(targetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = Array.from(new FormData(form).getAll('file')).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    if (!files.length) return;

    const oversized = files.find((file) => file.size > maxUploadBytes);
    if (oversized) {
      setMessage(uploadTooLargeMessage(maxUploadBytes));
      return;
    }

    setProgress((current) => ({ ...current, [targetId]: 0 }));
    setMessage('');
    try {
      for (const [index, file] of files.entries()) {
        const payload = new FormData();
        payload.append('originalFilename', file.name);
        payload.append('file', file);
        const { ticket } = await clientApi<{ ticket: string }>(
          `content/${targetId}/upload-ticket`,
          { method: 'POST' },
        );
        await clientUpload(
          `content-upload/${targetId}`,
          payload,
          (value) =>
            setProgress((current) => ({
              ...current,
              [targetId]: Math.round(((index + value / 100) / files.length) * 100),
            })),
          ticket,
          uploadBaseUrl,
        );
      }
      setMessage(`تم رفع ${files.length} ملف إلى قناة Telegram بنجاح.`);
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر رفع الملف.');
    } finally {
      setProgress((current) => {
        const next = { ...current };
        delete next[targetId];
        return next;
      });
    }
  }

  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">إدارة الملفات</p>
          <h1>رفع الملفات</h1>
          <p className="muted">
            يمكن فتح المرفقات من هنا حتى بعد نشرها. إذا تعذر تنزيل ملف من تليجرام، قد يُفتح منشوره
            الأصلي، ويتطلب ذلك صلاحية الوصول لقناة التخزين.
          </p>
          <p className="muted">الحد الأعلى للملف الواحد {maxUploadBytes / 1_000_000}MB.</p>
        </div>
      </header>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      <form
        method="get"
        action="/uploads"
        className="upload-filter-panel"
        aria-label="بحث وفلترة الملفات"
      >
        <div className="upload-search-row">
          <label className="upload-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">البحث عن المحتوى أو القسم</span>
            <input
              type="search"
              name="search"
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم المحتوى أو المادة أو القسم…"
            />
          </label>
          <button
            type="button"
            className="icon-button"
            title="مسح البحث والفلاتر"
            aria-label="مسح البحث والفلاتر"
            disabled={!hasFilters}
            onClick={() => {
              setQuery('');
              setFilters(emptyUploadFilters);
              router.push('/uploads');
            }}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <div className="flow-filters upload-filters">
          {uploadFilterKeys.map((key) => (
            <label key={key}>
              {filterLabels[key]}
              <select
                aria-label={filterLabels[key]}
                name={queryKeys[key]}
                value={filters[key]}
                onChange={(event) =>
                  setFilters((current) => changeUploadFilter(current, key, event.target.value))
                }
              >
                <option value="">الكل</option>
                {(options[key] ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="muted upload-result-count" role="status">
          عرض {items.length} من {total} — الصفحة {page}
        </p>
        <button type="submit">تطبيق البحث والفلاتر</button>
      </form>
      <nav className="row-actions" aria-label="صفحات رفع الملفات">
        {page > 1 && <Link href={pageUrl(page - 1)}>السابق</Link>}
        {page * pageSize < total && <Link href={pageUrl(page + 1)}>التالي</Link>}
      </nav>
      {items.length ? (
        <section className="content-list">
          {items.map((item) => {
            const currentProgress = progress[item.id];
            return (
              <article className="content-row" key={item.id}>
                <div>
                  <div className="row-title">
                    <UploadCloud size={18} />
                    <strong>{item.titleAr}</strong>
                  </div>
                  <p className="muted">
                    {item.section.course.semester.academicYear.nameAr} /{' '}
                    {item.section.course.semester.nameAr && (
                      <>{item.section.course.semester.nameAr} / </>
                    )}
                    {item.section.course.nameAr} / {item.section.nameAr}
                    {item.contentCategory?.nameAr && <> / {item.contentCategory.nameAr}</>}
                  </p>
                </div>
                {!!item.attachments?.length && (
                  <ul aria-label="الملفات المرفوعة">
                    {item.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={`/api/backend/content/${item.id}/attachments/${file.id}/open`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          فتح الملف: {file.originalFilename}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <form className="inline-upload" onSubmit={(event) => void upload(item.id, event)}>
                  <label>
                    <FileUp size={16} />
                    <span className="sr-only">اختيار الملفات</span>
                    <input
                      name="file"
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*,audio/*,video/mp4,video/webm"
                      multiple
                      required
                    />
                  </label>
                  <button
                    className="primary"
                    type="submit"
                    disabled={currentProgress !== undefined}
                  >
                    <UploadCloud size={17} />
                    {currentProgress === undefined
                      ? 'رفع'
                      : currentProgress === 100
                        ? 'جارٍ الحفظ في تليجرام'
                        : `رفع ${currentProgress}%`}
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      ) : (
        <p className="empty-state">لا توجد عناصر ملفات متاحة ضمن نطاقك الحالي.</p>
      )}
    </main>
  );
}
