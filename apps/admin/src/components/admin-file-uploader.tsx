'use client';

import { FileUp, Search, RotateCcw, UploadCloud } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { clientApi, clientUpload } from '../lib/client-api';
import { DIRECT_UPLOAD_TOO_LARGE_MESSAGE, MAX_UPLOAD_BYTES } from '../lib/upload-limits';
import {
  changeUploadFilter,
  emptyUploadFilters,
  matchesUploadTarget,
  uploadFilterKeys,
  uploadFilterOptions,
  type UploadTarget,
} from '../lib/upload-target-filters';

export type { UploadTarget } from '../lib/upload-target-filters';

const filterLabels = {
  year: 'السنة الدراسية',
  semester: 'الفصل',
  course: 'المادة',
  section: 'القسم',
  category: 'نوع المحتوى',
};

export function AdminFileUploader({ items }: { items: UploadTarget[] }) {
  const maxUploadBytes = MAX_UPLOAD_BYTES;
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(emptyUploadFilters);
  const visibleIds = new Set(
    items.filter((item) => matchesUploadTarget(item, filters, query)).map((item) => item.id),
  );
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
      setMessage(DIRECT_UPLOAD_TOO_LARGE_MESSAGE);
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
        );
      }
      setMessage(`تم رفع ${files.length} ملف إلى قناة Telegram بنجاح.`);
      form.reset();
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
          <p className="muted">الحد الأعلى للملف الواحد {maxUploadBytes / 1_000_000}MB.</p>
        </div>
      </header>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      <section className="upload-filter-panel" aria-label="بحث وفلترة الملفات">
        <div className="upload-search-row">
          <label className="upload-search">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">البحث عن المحتوى أو القسم</span>
            <input
              type="search"
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
                value={filters[key]}
                onChange={(event) =>
                  setFilters((current) => changeUploadFilter(current, key, event.target.value))
                }
              >
                <option value="">الكل</option>
                {uploadFilterOptions(items, filters, key).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="muted upload-result-count" role="status">
          عرض {visibleIds.size} من {items.length}
        </p>
      </section>

      {items.length > 0 && visibleIds.size === 0 && (
        <p className="empty-state">لا توجد نتائج مطابقة للبحث والفلاتر.</p>
      )}
      {items.length ? (
        <section className="content-list">
          {items.map((item) => {
            const currentProgress = progress[item.id];
            return (
              <article className="content-row" key={item.id} hidden={!visibleIds.has(item.id)}>
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
