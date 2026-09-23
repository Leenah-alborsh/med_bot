'use client';
import {
  Archive,
  ArchiveRestore,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi, clientUpload } from '../lib/client-api';
type Item = {
  id: string;
  titleAr: string;
  titleEn?: string;
  sectionId: string;
  bodyText?: string;
  contentType: 'TEXT' | 'LINK' | 'FILE';
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  displayOrder: number;
  section: {
    nameAr: string;
    course: { id: string; nameAr: string; semester: { id: string; academicYearId: string } };
  };
  attachments: Array<{
    id: string;
    storageProvider: 'TELEGRAM' | 'EXTERNAL_URL';
    originalFilename: string;
    externalUrl?: string;
  }>;
};
type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
};
type Section = Option;
const contentTypeLabels = { TEXT: 'نص', LINK: 'رابط', FILE: 'ملف' } as const;
const stateLabels = { DRAFT: 'مسودة', PUBLISHED: 'منشور', ARCHIVED: 'مؤرشف' } as const;
export function ContentManager({
  items,
  sections,
  courses,
  semesters,
  years,
}: {
  items: Item[];
  sections: Section[];
  courses: Option[];
  semesters: Option[];
  years: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const [filterYearId, setFilterYearId] = useState('');
  const [filterSemesterId, setFilterSemesterId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterType, setFilterType] = useState('');
  const visibleSemesters = semesters.filter(
    (semester) => !filterYearId || semester.academicYearId === filterYearId,
  );
  const visibleCourses = courses.filter(
    (course) =>
      (!filterYearId || course.academicYearId === filterYearId) &&
      (!filterSemesterId || course.semesterId === filterSemesterId),
  );
  const filteredItems = items.filter(
    (item) =>
      (!filterYearId || item.section.course.semester.academicYearId === filterYearId) &&
      (!filterSemesterId || item.section.course.semester.id === filterSemesterId) &&
      (!filterCourseId || item.section.course.id === filterCourseId) &&
      (!filterType || item.contentType === filterType),
  );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const item = await clientApi<{ id: string }>('content', {
        method: 'POST',
        body: JSON.stringify({
          sectionId: data.get('sectionId'),
          titleAr: data.get('titleAr'),
          titleEn: data.get('titleEn') || undefined,
          contentType: data.get('contentType'),
          bodyText: data.get('bodyText') || undefined,
          displayOrder: Number(data.get('displayOrder')),
        }),
      });
      const externalUrl = data.get('externalUrl');
      const url = typeof externalUrl === 'string' ? externalUrl.trim() : '';
      if (url)
        await clientApi(`content/${item.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            storageProvider: 'EXTERNAL_URL',
            originalFilename: 'external-link',
            externalUrl: url,
            mimeType: 'text/uri-list',
            fileSize: 0,
          }),
        });
      form.reset();
      setMessage('تم إنشاء المحتوى كمسودة.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء المحتوى.');
    }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    try {
      await clientApi(`content/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sectionId: data.get('sectionId'),
          titleAr: data.get('titleAr'),
          titleEn: data.get('titleEn') || undefined,
          contentType: data.get('contentType'),
          bodyText: data.get('bodyText') || undefined,
          displayOrder: Number(data.get('displayOrder')),
        }),
      });
      setEditing(null);
      setMessage('تم حفظ تعديلات المحتوى.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تعديل المحتوى.');
    }
  }
  async function remove(id: string) {
    if (!confirm('سيُحذف المحتوى وملفاته نهائيًا. هل أنت متأكد؟')) return;
    try {
      await clientApi(`content/${id}`, { method: 'DELETE' });
      setEditing(null);
      setMessage('تم حذف المحتوى.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حذف المحتوى.');
    }
  }
  async function state(id: string, next: 'PUBLISHED' | 'ARCHIVED') {
    if (next === 'ARCHIVED' && !confirm('هل تريد أرشفة هذا المحتوى؟')) return;
    try {
      await clientApi(`content/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: next }),
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحديث الحالة.');
    }
  }
  async function restore(id: string) {
    try {
      await clientApi(`content/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: 'DRAFT' }),
      });
      setMessage('تمت استعادة المحتوى كمسودة.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت استعادة المحتوى.');
    }
  }
  async function addLink(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawUrl = data.get('externalUrl');
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    try {
      await clientApi(`content/${id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          storageProvider: 'EXTERNAL_URL',
          originalFilename: 'external-link',
          externalUrl: url,
          mimeType: 'text/uri-list',
          fileSize: 0,
        }),
      });
      form.reset();
      setMessage('تمت إضافة الرابط.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت إضافة الرابط.');
    }
  }
  async function upload(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const selected = form.elements.namedItem('file');
    const files = selected instanceof HTMLInputElement ? Array.from(selected.files ?? []) : [];
    if (!files.length) return;
    try {
      for (const [index, file] of files.entries()) {
        const data = new FormData();
        data.append('file', file);
        setUploadProgress((current) => ({
          ...current,
          [id]: Math.round((index / files.length) * 100),
        }));
        const { ticket } = await clientApi<{ ticket: string }>(`content/${id}/upload-ticket`, {
          method: 'POST',
        });
        await clientUpload(
          `content-upload/${id}`,
          data,
          (value) =>
            setUploadProgress((current) => ({
              ...current,
              [id]: Math.round(((index + value / 100) / files.length) * 100),
            })),
          ticket,
        );
      }
      setMessage(
        files.length > 1
          ? `تم رفع ${files.length} ملفات وحفظها في Telegram.`
          : 'تم رفع الملف وحفظه في Telegram.',
      );
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر رفع الملفات.');
    } finally {
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">المكتبة التعليمية</p>
          <h1>المحتوى والملفات</h1>
          <p className="muted">أنشئ المحتوى، أرفق موارده، ثم انشره للطلاب.</p>
        </div>
      </header>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="flow-filters content-filters" aria-label="فلاتر المحتوى">
        <label>
          السنة الدراسية
          <select
            value={filterYearId}
            onChange={(event) => {
              setFilterYearId(event.target.value);
              setFilterSemesterId('');
              setFilterCourseId('');
            }}
          >
            <option value="">كل السنوات</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          الفصل الدراسي
          <select
            value={filterSemesterId}
            onChange={(event) => {
              setFilterSemesterId(event.target.value);
              setFilterCourseId('');
            }}
          >
            <option value="">كل الفصول</option>
            {visibleSemesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          المادة
          <select
            value={filterCourseId}
            onChange={(event) => setFilterCourseId(event.target.value)}
          >
            <option value="">كل المواد</option>
            {visibleCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          نوع المحتوى
          <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
            <option value="">كل الأنواع</option>
            <option value="FILE">ملفات</option>
            <option value="LINK">روابط</option>
            <option value="TEXT">نصوص</option>
          </select>
        </label>
      </section>
      <section className="workspace-grid content-workspace">
        <div className="content-list">
          {filteredItems
            .filter((item) => item.state !== 'ARCHIVED')
            .map((item) => (
              <article className="content-row" key={item.id}>
                <div>
                  <div className="row-title">
                    <strong>{item.titleAr}</strong>
                    <span className="badge" data-state={item.state.toLowerCase()}>
                      {stateLabels[item.state]}
                    </span>
                  </div>
                  <span className="muted">
                    {item.section.course.nameAr} / {item.section.nameAr} ·{' '}
                    {contentTypeLabels[item.contentType]}
                  </span>
                </div>
                <div className="row-actions action-cluster">
                  <button
                    className="icon-button"
                    title="تعديل"
                    aria-label="تعديل"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={17} />
                  </button>
                  {item.state !== 'PUBLISHED' && (
                    <button
                      className="icon-button success"
                      title="نشر"
                      onClick={() => void state(item.id, 'PUBLISHED')}
                    >
                      <Send size={17} />
                    </button>
                  )}
                  <button
                    className="icon-button archive"
                    title="أرشفة"
                    aria-label="أرشفة"
                    onClick={() => void state(item.id, 'ARCHIVED')}
                    disabled={item.state === 'ARCHIVED'}
                  >
                    <Archive size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    title={item.state === 'ARCHIVED' ? 'حذف نهائي' : 'أرشف المحتوى أولًا'}
                    aria-label="حذف نهائي"
                    onClick={() => void remove(item.id)}
                    disabled={item.state !== 'ARCHIVED'}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {editing?.id === item.id && (
                  <form className="inline-editor form" onSubmit={saveEdit}>
                    <div className="section-title">
                      <Pencil size={17} />
                      <h2>تعديل المحتوى</h2>
                      <button
                        className="icon-button dismiss"
                        type="button"
                        title="إلغاء"
                        onClick={() => setEditing(null)}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="compact-form-grid">
                      <label>
                        القسم
                        <select name="sectionId" defaultValue={editing.sectionId} required>
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.nameAr}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        العنوان بالعربية
                        <input name="titleAr" defaultValue={editing.titleAr} required />
                      </label>
                      <label>
                        العنوان بالإنجليزية
                        <input name="titleEn" defaultValue={editing.titleEn ?? ''} dir="ltr" />
                      </label>
                      <label>
                        النوع
                        <select name="contentType" defaultValue={editing.contentType}>
                          <option value="TEXT">نص</option>
                          <option value="LINK">رابط</option>
                          <option value="FILE">ملف</option>
                        </select>
                      </label>
                      <label>
                        ترتيب العرض
                        <input
                          name="displayOrder"
                          type="number"
                          min="0"
                          defaultValue={editing.displayOrder}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      النص أو الوصف
                      <textarea name="bodyText" rows={4} defaultValue={editing.bodyText ?? ''} />
                    </label>
                    <div className="form-actions">
                      <button className="primary" type="submit">
                        <Save size={17} /> حفظ التعديلات
                      </button>
                      <button type="button" onClick={() => setEditing(null)}>
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
                {item.contentType === 'FILE' && (
                  <form className="inline-upload" onSubmit={(event) => void upload(item.id, event)}>
                    <label>
                      <Paperclip size={16} />
                      <span>إرفاق ملف</span>
                      <input
                        name="file"
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*,audio/*,video/mp4,video/webm"
                        multiple
                        required
                      />
                    </label>
                    <button type="submit" disabled={uploadProgress[item.id] !== undefined}>
                      {uploadProgress[item.id] === undefined
                        ? 'رفع'
                        : `رفع ${uploadProgress[item.id]}%`}
                    </button>
                  </form>
                )}
                {item.contentType === 'LINK' && (
                  <form
                    className="inline-upload"
                    onSubmit={(event) => void addLink(item.id, event)}
                  >
                    <label>
                      <Link2 size={16} />
                      <span>إضافة رابط آخر</span>
                      <input
                        name="externalUrl"
                        type="url"
                        dir="ltr"
                        placeholder="https://"
                        required
                      />
                    </label>
                    <button type="submit">إضافة</button>
                  </form>
                )}
                {!!item.attachments.length && (
                  <small className="attachment-count">{item.attachments.length} مرفق</small>
                )}
              </article>
            ))}
          {!filteredItems.some((item) => item.state !== 'ARCHIVED') && (
            <div className="empty-state">لا يوجد محتوى نشط. ابدأ من النموذج المجاور.</div>
          )}
          {filteredItems.some((item) => item.state === 'ARCHIVED') && (
            <details className="archive-drawer">
              <summary>
                <Archive size={17} /> المحتوى المؤرشف{' '}
                <span>{filteredItems.filter((item) => item.state === 'ARCHIVED').length}</span>
              </summary>
              <div className="archive-list">
                {filteredItems
                  .filter((item) => item.state === 'ARCHIVED')
                  .map((item) => (
                    <div className="archive-item" key={item.id}>
                      <div>
                        <strong>{item.titleAr}</strong>
                        <small>
                          {item.section.course.nameAr} / {item.section.nameAr}
                        </small>
                      </div>
                      <div className="row-actions">
                        <button
                          className="icon-button success"
                          title="استعادة كمسودة"
                          onClick={() => void restore(item.id)}
                        >
                          <ArchiveRestore size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="حذف نهائي"
                          onClick={() => void remove(item.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
        <form className="editor-panel form" onSubmit={create}>
          <div className="section-title">
            <Plus size={18} />
            <h2>محتوى جديد</h2>
          </div>
          <label>
            القسم
            <select name="sectionId" required>
              <option value="">اختر القسم</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </select>
          </label>
          <label>
            العنوان بالعربية
            <input name="titleAr" required />
          </label>
          <label>
            العنوان بالإنجليزية
            <input name="titleEn" dir="ltr" />
          </label>
          <label>
            النوع
            <select name="contentType" required>
              <option value="TEXT">نص</option>
              <option value="LINK">رابط</option>
              <option value="FILE">ملف</option>
            </select>
          </label>
          <label>
            النص أو الوصف
            <textarea name="bodyText" rows={5} />
          </label>
          <label>
            رابط HTTPS (اختياري)
            <input name="externalUrl" type="url" dir="ltr" placeholder="https://" />
          </label>
          <label>
            ترتيب العرض
            <input name="displayOrder" type="number" min="0" required />
          </label>
          <button className="primary" type="submit">
            <Plus size={17} />
            حفظ كمسودة
          </button>
        </form>
      </section>
    </main>
  );
}
