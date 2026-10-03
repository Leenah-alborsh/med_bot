'use client';

import { Check, FileArchive, FilePlus2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi } from '../lib/client-api';

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
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [courseChoice, setCourseChoice] = useState('');
  const [sectionChoice, setSectionChoice] = useState('');
  const [newCourseHasSections, setNewCourseHasSections] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = items.find((item) => item.id === selectedId);
  const visibleSemesters = semesters.filter((item) => item.academicYearId === yearId);
  const visibleCourses = courses.filter((item) => item.semesterId === semesterId);
  const selectedCourse = courses.find((item) => item.id === courseChoice);
  const isNewCourse = courseChoice === '__new__';
  const hasSections = isNewCourse ? newCourseHasSections : selectedCourse?.hasSections !== false;
  const visibleSections = sections.filter((item) => item.courseId === courseChoice);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function resetPathAfterYear(value: string) {
    setYearId(value);
    setSemesterId('');
    setCourseChoice('');
    setSectionChoice('');
  }

  async function classify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publish = submitter?.value === 'publish';
    const body: Record<string, unknown> = {
      titleAr: data.get('titleAr'),
      titleEn: data.get('titleEn') || undefined,
      descriptionAr: data.get('descriptionAr') || undefined,
      displayOrder: Number(data.get('displayOrder')),
      publish,
    };
    if (isNewCourse) {
      body.newCourse = {
        semesterId,
        nameAr: data.get('courseNameAr'),
        nameEn: data.get('courseNameEn') || undefined,
        displayOrder: Number(data.get('courseDisplayOrder')),
        hasSections: newCourseHasSections,
      };
    } else {
      body.courseId = courseChoice;
    }
    if (hasSections) {
      if (sectionChoice === '__new__') {
        body.newSection = {
          nameAr: data.get('sectionNameAr'),
          nameEn: data.get('sectionNameEn') || undefined,
          displayOrder: Number(data.get('sectionDisplayOrder')),
        };
      } else {
        body.sectionId = sectionChoice;
      }
    }

    setSaving(true);
    setMessage('');
    try {
      await clientApi(`telegram-inbox/${selected.id}/classify`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSelectedId('');
      setMessage(publish ? 'تم تصنيف الملف ونشره.' : 'تم تصنيف الملف وحفظه كمسودة.');
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
                <tr key={item.id}>
                  <td>
                    <strong>{item.fileName}</strong>
                    <span className="table-subtitle">{item.mediaType}</span>
                  </td>
                  <td>{item.mimeType}</td>
                  <td dir="ltr">{formatSize(item.fileSize)}</td>
                  <td>{receivedAtFormatter.format(new Date(item.receivedAt))}</td>
                  <td>
                    <button
                      className="icon-button"
                      type="button"
                      title="تصنيف"
                      aria-label={`تصنيف ${item.fileName}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setMessage('');
                      }}
                    >
                      <FilePlus2 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <p className="empty-state">لا توجد ملفات غير مصنفة.</p> : null}
        </div>

        {selected ? (
          <form className="editor-panel form inbox-classifier" onSubmit={classify}>
            <div className="section-title">
              <FileArchive size={18} />
              <div>
                <h2>تصنيف الملف</h2>
                <small>{selected.fileName}</small>
              </div>
            </div>

            <label>
              السنة الدراسية
              <select
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
                value={semesterId}
                onChange={(event) => {
                  setSemesterId(event.target.value);
                  setCourseChoice('');
                  setSectionChoice('');
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
                value={courseChoice}
                onChange={(event) => {
                  setCourseChoice(event.target.value);
                  setSectionChoice('');
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
                <option value="__new__">+ إنشاء مادة جديدة</option>
              </select>
            </label>

            {isNewCourse ? (
              <fieldset className="inline-fields">
                <legend>المادة الجديدة</legend>
                <label>
                  الاسم بالعربية
                  <input name="courseNameAr" required />
                </label>
                <label>
                  الاسم بالإنجليزية
                  <input name="courseNameEn" dir="ltr" />
                </label>
                <label>
                  ترتيب العرض
                  <input name="courseDisplayOrder" type="number" min="0" required />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={newCourseHasSections}
                    onChange={(event) => {
                      setNewCourseHasSections(event.target.checked);
                      setSectionChoice('');
                    }}
                  />
                  المادة تحتوي أقسامًا
                </label>
              </fieldset>
            ) : null}

            {courseChoice && hasSections ? (
              <label>
                القسم
                <select
                  value={sectionChoice}
                  onChange={(event) => setSectionChoice(event.target.value)}
                  required
                >
                  <option value="">اختر القسم</option>
                  {visibleSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.nameAr}
                    </option>
                  ))}
                  <option value="__new__">+ إنشاء قسم جديد</option>
                </select>
              </label>
            ) : null}

            {hasSections && sectionChoice === '__new__' ? (
              <fieldset className="inline-fields">
                <legend>القسم الجديد</legend>
                <label>
                  الاسم بالعربية
                  <input name="sectionNameAr" required />
                </label>
                <label>
                  الاسم بالإنجليزية
                  <input name="sectionNameEn" dir="ltr" />
                </label>
                <label>
                  ترتيب العرض
                  <input name="sectionDisplayOrder" type="number" min="0" required />
                </label>
              </fieldset>
            ) : null}

            <label>
              العنوان
              <input name="titleAr" defaultValue={selected.fileName} required />
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
              <input name="displayOrder" type="number" min="0" required />
            </label>

            <div className="form-actions">
              <button
                type="submit"
                value="draft"
                disabled={saving || !courseChoice || (hasSections && !sectionChoice)}
              >
                حفظ كمسودة
              </button>
              <button
                className="primary"
                type="submit"
                value="publish"
                disabled={saving || !courseChoice || (hasSections && !sectionChoice)}
              >
                <Check size={17} /> نشر مباشرة
              </button>
            </div>
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
