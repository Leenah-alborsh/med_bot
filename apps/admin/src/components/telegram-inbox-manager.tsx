'use client';

import { Check, FileArchive, FilePlus2, Paperclip, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi } from '../lib/client-api';
import { inboxCategories } from '../lib/inbox-classification';

type InboxFile = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: string;
  mediaType: string;
  receivedAt: string;
};

type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
  hasSections?: boolean;
};

const receivedAtFormatter = new Intl.DateTimeFormat('ar-PS', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Hebron',
});

type Props = {
  items: InboxFile[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  years: Option[];
  semesters: Option[];
  courses: Option[];
  sections: Option[];
  categories: Option[];
  targets: Array<{
    id: string;
    titleAr: string;
    sectionId: string;
    contentCategoryId: string;
    state: string;
  }>;
  canCreate: boolean;
  canUpdate: boolean;
  canPublish: boolean;
};

function formatSize(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'غير معروف';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function TelegramInboxManager({
  items,
  total,
  page,
  pageSize,
  search,
  years,
  semesters,
  courses,
  sections,
  categories,
  targets,
  canCreate,
  canUpdate,
  canPublish,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [courseChoice, setCourseChoice] = useState('');
  const [sectionChoice, setSectionChoice] = useState('');
  const [mode, setMode] = useState<'create' | 'attach'>(canCreate ? 'create' : 'attach');
  const [categoryId, setCategoryId] = useState('');
  const [contentId, setContentId] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = items.find((item) => item.id === selectedId);
  const visibleSemesters = semesters.filter((item) => item.academicYearId === yearId);
  const visibleCourses = courses.filter((item) => item.semesterId === semesterId);
  const selectedCourse = courses.find((item) => item.id === courseChoice);
  const hasSections = selectedCourse?.hasSections !== false;
  const visibleSections = sections.filter((item) => item.courseId === courseChoice);
  const visibleCategories = inboxCategories(
    categories,
    sections,
    courseChoice,
    sectionChoice,
    hasSections,
  );
  const visibleTargets = targets.filter((item) => item.contentCategoryId === categoryId);
  const validCategory = visibleCategories.some((item) => item.id === categoryId);
  const validTarget = visibleTargets.some((item) => item.id === contentId);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function resetPathAfterYear(value: string) {
    setYearId(value);
    setSemesterId('');
    setCourseChoice('');
    setSectionChoice('');
    resetCategory();
  }
  function resetCategory() {
    setCategoryId('');
    setContentId('');
  }

  async function classify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving || !validCategory || (mode === 'attach' && !validTarget)) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publish = mode === 'create' && submitter?.value === 'publish' && canPublish;
    const body: Record<string, unknown> =
      mode === 'attach'
        ? { contentItemId: contentId }
        : {
            courseId: courseChoice,
            sectionId: hasSections ? sectionChoice : undefined,
            contentCategoryId: categoryId,
            titleAr: data.get('titleAr'),
            titleEn: data.get('titleEn') || undefined,
            descriptionAr: data.get('descriptionAr') || undefined,
            displayOrder: Number(data.get('displayOrder')),
            publish,
          };

    setSaving(true);
    setMessage('');
    try {
      await clientApi(`telegram-inbox/${selected.id}/classify-existing`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSelectedId('');
      setMessage(
        mode === 'attach'
          ? 'تم إرفاق الملف بالمحتوى المحدد.'
          : publish
            ? 'تم تصنيف الملف ونشره.'
            : 'تم تصنيف الملف وحفظه كمسودة.',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تصنيف الملف.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <header className="page-heading inbox-heading">
        <div>
          <p className="eyebrow">Telegram Channel Inbox</p>
          <h1>الملفات الواردة</h1>
          <p className="muted">ملفات قناة التخزين التي لم تُربط بالمحتوى بعد.</p>
        </div>
        <span className="metric-inline">{total} غير مصنف</span>
      </header>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      <form className="inbox-search" method="get">
        <Search size={18} />
        <input name="search" defaultValue={search} placeholder="ابحث بالاسم أو النوع" />
        <button type="submit">بحث</button>
      </form>

      <section className="inbox-workspace">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الملف</th>
                <th>النوع</th>
                <th>الحجم</th>
                <th>تاريخ الوصول</th>
                <th aria-label="إجراء" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-selected={selectedId === item.id}>
                  <td>
                    <strong>{item.fileName}</strong>
                    <span className="table-subtitle">{item.mediaType}</span>
                  </td>
                  <td>{item.mimeType}</td>
                  <td dir="ltr">{formatSize(item.fileSize)}</td>
                  <td>{receivedAtFormatter.format(new Date(item.receivedAt))}</td>
                  <td>
                    {(canCreate || canUpdate) && (
                      <button
                        className="icon-button"
                        type="button"
                        disabled={saving}
                        title="تصنيف"
                        aria-label={`تصنيف ${item.fileName}`}
                        onClick={() => {
                          setSelectedId(item.id);
                          setMessage('');
                        }}
                      >
                        <FilePlus2 size={17} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <p className="empty-state">لا توجد ملفات غير مصنفة.</p> : null}
        </div>

        {selected ? (
          <form
            key={`${selected.id}-${mode}`}
            className="editor-panel form inbox-classifier"
            onSubmit={classify}
          >
            <div className="section-title">
              <FileArchive size={18} />
              <div>
                <h2>تصنيف الملف</h2>
                <small>{selected.fileName}</small>
              </div>
              <button
                className="icon-button dismiss"
                type="button"
                title="إغلاق"
                aria-label="إغلاق التصنيف"
                disabled={saving}
                onClick={() => setSelectedId('')}
              >
                <X size={18} />
              </button>
            </div>
            <fieldset className="inbox-classification-fields" disabled={saving}>
              {canCreate && canUpdate && (
                <div className="classification-mode" role="group" aria-label="طريقة ربط الملف">
                  <button
                    type="button"
                    aria-pressed={mode === 'create'}
                    onClick={() => setMode('create')}
                  >
                    <FilePlus2 size={16} />
                    ملف جديد
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === 'attach'}
                    onClick={() => setMode('attach')}
                  >
                    <Paperclip size={16} />
                    محتوى موجود
                  </button>
                </div>
              )}
              <label>
                السنة الدراسية
                <select
                aria-label="السنة الدراسية"
                  value={yearId}
                  onChange={(event) => resetPathAfterYear(event.target.value)}
                  required
                >
                  <option value="">اختر السنة</option>
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
                aria-label="الفصل الدراسي"
                  value={semesterId}
                  onChange={(event) => {
                    setSemesterId(event.target.value);
                    setCourseChoice('');
                    setSectionChoice('');
                    resetCategory();
                  }}
                  required
                  disabled={!yearId}
                >
                  <option value="">اختر الفصل</option>
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
                aria-label="المادة"
                  value={courseChoice}
                  onChange={(event) => {
                    setCourseChoice(event.target.value);
                    setSectionChoice('');
                    resetCategory();
                  }}
                  required
                  disabled={!semesterId}
                >
                  <option value="">اختر المادة</option>
                  {visibleCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.nameAr}
                    </option>
                  ))}
                </select>
              </label>

              {courseChoice && hasSections ? (
                <label>
                  القسم
                  <select
                  aria-label="القسم"
                    value={sectionChoice}
                    onChange={(event) => {
                      setSectionChoice(event.target.value);
                      resetCategory();
                    }}
                    required
                  >
                    <option value="">اختر القسم</option>
                    {visibleSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.nameAr}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label>
                نوع المحتوى
                <select
                aria-label="نوع المحتوى"
                  value={categoryId}
                  required
                  disabled={!courseChoice || (hasSections && !sectionChoice)}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setContentId('');
                  }}
                >
                  <option value="">اختر نوع المحتوى</option>
                  {visibleCategories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nameAr}
                    </option>
                  ))}
                </select>
              </label>
              {courseChoice && (!hasSections || sectionChoice) && !visibleCategories.length && (
                <p className="form-message">لا توجد أنواع محتوى متاحة في هذا المسار.</p>
              )}
              {mode === 'attach' ? (
                <>
                  <label>
                    المحتوى
                    <select
                    aria-label="المحتوى"
                      value={contentId}
                      required
                      disabled={!categoryId}
                      onChange={(event) => setContentId(event.target.value)}
                    >
                      <option value="">اختر المحتوى</option>
                      {visibleTargets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.titleAr}
                          {item.state === 'DRAFT' ? ' (مسودة)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {categoryId && !visibleTargets.length && (
                    <p className="form-message">لا يوجد محتوى ملفات متاح في هذا النوع.</p>
                  )}
                </>
              ) : (
                <>
                  <label>
                    العنوان
                    <input
                      name="titleAr"
                      defaultValue={selected.fileName}
                      maxLength={200}
                      required
                    />
                  </label>
                  <label>
                    العنوان بالإنجليزية
                    <input name="titleEn" dir="ltr" />
                  </label>
                  <label>
                    الوصف
                    <textarea name="descriptionAr" rows={4} />
                  </label>
                  <label>
                    ترتيب العرض
                    <input name="displayOrder" type="number" min="0" max="10000" required />
                  </label>
                </>
              )}
              <div className="form-actions">
                {mode === 'attach' ? (
                  <button
                    className="primary"
                    type="submit"
                    disabled={!validCategory || !validTarget}
                  >
                    <Paperclip size={17} />
                    إرفاق الملف
                  </button>
                ) : (
                  <>
                    <button type="submit" value="draft" disabled={!validCategory}>
                      حفظ كمسودة
                    </button>
                    {canPublish && (
                      <button
                        className="primary"
                        type="submit"
                        value="publish"
                        disabled={!validCategory}
                      >
                        <Check size={17} /> نشر مباشرة
                      </button>
                    )}
                  </>
                )}
              </div>
            </fieldset>
          </form>
        ) : null}
      </section>

      {pageCount > 1 ? (
        <nav className="pagination" aria-label="صفحات الملفات الواردة">
          {page > 1 ? (
            <a href={`?page=${page - 1}&search=${encodeURIComponent(search)}`}>السابق</a>
          ) : (
            <span />
          )}
          <span>
            صفحة {page} من {pageCount}
          </span>
          {page < pageCount ? (
            <a href={`?page=${page + 1}&search=${encodeURIComponent(search)}`}>التالي</a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
