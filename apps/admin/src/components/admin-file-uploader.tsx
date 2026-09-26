'use client';

import { FileUp, UploadCloud } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { clientApi, clientUpload } from '../lib/client-api';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MEGABYTES } from '../lib/upload-limits';

export type UploadTarget = {
  id: string;
  titleAr: string;
  section: {
    nameAr: string;
    course: {
      nameAr: string;
      semester: {
        academicYear: { nameAr: string };
      };
    };
  };
};

export function AdminFileUploader({ items }: { items: UploadTarget[] }) {
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<Record<string, number>>({});

  async function upload(targetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = Array.from(new FormData(form).getAll('file')).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    if (!files.length) return;

    const oversized = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversized) {
      setMessage(`الملف ${oversized.name} يتجاوز الحد الأقصى المسموح ${MAX_UPLOAD_MEGABYTES}MB.`);
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
          <p className="muted">الحد الأعلى للملف الواحد {MAX_UPLOAD_MEGABYTES}MB.</p>
        </div>
      </header>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

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
                    {item.section.course.nameAr} / {item.section.nameAr}
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
                    {currentProgress === undefined ? 'رفع' : `رفع ${currentProgress}%`}
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
