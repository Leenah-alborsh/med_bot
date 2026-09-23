'use client';
import { useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

type Item = {
  id: string;
  nameAr: string;
  nameEn: string;
  displayOrder: number;
  isActive: boolean;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
};
type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
};
type Kind = 'years' | 'semesters' | 'courses' | 'sections' | 'content-types';
const labels: Record<Kind, { title: string; singular: string }> = {
  years: {
    title: 'السنوات الدراسية',
    singular: 'سنة دراسية',
  },
  semesters: { title: 'الفصول', singular: 'فصل' },
  courses: { title: 'المواد', singular: 'مادة' },
  sections: { title: 'الأقسام', singular: 'قسم' },
  'content-types': { title: 'أنواع المحتوى', singular: 'نوع محتوى' },
};
export function CatalogManager({
  kind,
  items,
  parents = [],
  years = [],
  semesters = [],
  courses = [],
  sections = [],
}: {
  kind: Kind;
  items: Item[];
  parents?: Option[];
  years?: Option[];
  semesters?: Option[];
  courses?: Option[];
  sections?: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [filterYearId, setFilterYearId] = useState('');
  const [filterSemesterId, setFilterSemesterId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const visibleParents =
    kind === 'courses'
      ? parents.filter((parent) => parent.academicYearId === selectedYearId)
      : kind === 'sections'
        ? parents.filter(
            (parent) =>
              (!filterYearId || parent.academicYearId === filterYearId) &&
              (!filterSemesterId || parent.semesterId === filterSemesterId),
          )
        : kind === 'content-types'
          ? parents.filter(
              (parent) =>
                (!filterYearId || parent.academicYearId === filterYearId) &&
                (!filterSemesterId || parent.semesterId === filterSemesterId) &&
                (!filterCourseId || parent.courseId === filterCourseId),
            )
          : parents;
  const parentKey =
    kind === 'semesters'
      ? 'academicYearId'
      : kind === 'courses'
        ? 'semesterId'
        : kind === 'sections'
          ? 'courseId'
          : 'sectionId';
  const visibleSemesters = semesters.filter(
    (semester) => !filterYearId || semester.academicYearId === filterYearId,
  );
  const visibleCourses = courses.filter(
    (course) =>
      (!filterYearId || course.academicYearId === filterYearId) &&
      (!filterSemesterId || course.semesterId === filterSemesterId),
  );
  const visibleSections = sections.filter(
    (section) =>
      (!filterYearId || section.academicYearId === filterYearId) &&
      (!filterSemesterId || section.semesterId === filterSemesterId) &&
      (!filterCourseId || section.courseId === filterCourseId),
  );
  const filteredItems = items.filter(
    (item) =>
      (!filterYearId || item.academicYearId === filterYearId) &&
      (!filterSemesterId || item.semesterId === filterSemesterId) &&
      (!filterCourseId || item.courseId === filterCourseId) &&
      (!filterSectionId || item.sectionId === filterSectionId),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const body: Record<string, unknown> = {
      nameAr: data.get('nameAr'),
      nameEn: data.get('nameEn'),
      displayOrder: Number(data.get('displayOrder')),
      isActive: true,
    };
    if (kind === 'years') body.number = Number(data.get('number'));
    else body[parentKey] = data.get(parentKey);
    try {
      await clientApi(`catalog/${kind}`, { method: 'POST', body: JSON.stringify(body) });
      form.reset();
      setMessage('تم الحفظ بنجاح.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر الحفظ.');
    }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    try {
      await clientApi(`catalog/${kind.slice(0, -1)}/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nameAr: data.get('nameAr'),
          nameEn: data.get('nameEn'),
          displayOrder: Number(data.get('displayOrder')),
        }),
      });
      setEditing(null);
      setMessage('تم حفظ التعديلات.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ التعديلات.');
    }
  }
  async function archive(id: string) {
    if (!confirm('هل تريد أرشفة هذا العنصر؟')) return;
    try {
      await clientApi(`catalog/${kind.slice(0, -1)}/${id}/archive`, { method: 'POST' });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت الأرشفة.');
    }
  }
  async function restore(id: string) {
    try {
      await clientApi(`catalog/${kind.slice(0, -1)}/${id}/restore`, { method: 'POST' });
      setMessage('تمت استعادة العنصر.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت الاستعادة.');
    }
  }
  async function remove(id: string) {
    if (!confirm('سيُحذف هذا العنصر نهائيًا. هل أنت متأكد؟')) return;
    try {
      await clientApi(`catalog/${kind.slice(0, -1)}/${id}`, { method: 'DELETE' });
      setMessage('تم حذف العنصر.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حذف العنصر.');
    }
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">الهيكل الأكاديمي</p>
          <h1>{labels[kind].title}</h1>
          <p className="muted">إدارة مرتبة وآمنة للمسار الذي يظهر للطلاب.</p>
        </div>
      </header>
      {kind !== 'years' && (
        <section className="flow-filters" aria-label="فلاتر المسار الأكاديمي">
          <label>
            السنة الدراسية
            <select
              value={filterYearId}
              onChange={(event) => {
                setFilterYearId(event.target.value);
                setFilterSemesterId('');
                setFilterCourseId('');
                setFilterSectionId('');
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
          {(kind === 'courses' || kind === 'sections' || kind === 'content-types') && (
            <label>
              الفصل الدراسي
              <select
                value={filterSemesterId}
                onChange={(event) => {
                  setFilterSemesterId(event.target.value);
                  setFilterCourseId('');
                  setFilterSectionId('');
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
          )}
          {(kind === 'sections' || kind === 'content-types') && (
            <label>
              المادة
              <select
                value={filterCourseId}
                onChange={(event) => {
                  setFilterCourseId(event.target.value);
                  setFilterSectionId('');
                }}
              >
                <option value="">كل المواد</option>
                {visibleCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'content-types' && (
            <label>
              القسم
              <select
                value={filterSectionId}
                onChange={(event) => setFilterSectionId(event.target.value)}
              >
                <option value="">كل الأقسام</option>
                {visibleSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}
      <section className="workspace-grid">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الاسم بالإنجليزية</th>
                <th>الترتيب</th>
                <th>الحالة</th>
                <th>
                  <span className="sr-only">الإجراءات</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems
                .filter((item) => item.isActive)
                .map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nameAr}</strong>
                    </td>
                    <td>{item.nameEn}</td>
                    <td>{item.displayOrder}</td>
                    <td>
                      <span className="badge" data-state={item.isActive ? 'active' : 'inactive'}>
                        {item.isActive ? 'نشط' : 'مؤرشف'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions action-cluster">
                        <button
                          className="icon-button"
                          title="تعديل"
                          aria-label="تعديل"
                          onClick={() => setEditing(item)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button archive"
                          title="أرشفة"
                          aria-label="أرشفة"
                          onClick={() => void archive(item.id)}
                          disabled={!item.isActive}
                        >
                          <Archive size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title={item.isActive ? 'أرشف العنصر أولًا' : 'حذف نهائي'}
                          aria-label="حذف نهائي"
                          onClick={() => void remove(item.id)}
                          disabled={item.isActive}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!filteredItems.some((item) => item.isActive) && (
            <div className="empty-state">لا توجد عناصر نشطة حتى الآن.</div>
          )}
          {filteredItems.some((item) => !item.isActive) && (
            <details className="archive-drawer">
              <summary>
                <Archive size={17} /> المؤرشفة{' '}
                <span>{filteredItems.filter((item) => !item.isActive).length}</span>
              </summary>
              <div className="archive-list">
                {filteredItems
                  .filter((item) => !item.isActive)
                  .map((item) => (
                    <div className="archive-item" key={item.id}>
                      <div>
                        <strong>{item.nameAr}</strong>
                        <small>{item.nameEn}</small>
                      </div>
                      <div className="row-actions">
                        <button
                          className="icon-button success"
                          title="استعادة"
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
        {editing && (
          <form className="editor-panel form edit-panel" onSubmit={saveEdit}>
            <div className="section-title">
              <Pencil size={18} />
              <h2>تعديل {labels[kind].singular}</h2>
              <button
                className="icon-button dismiss"
                type="button"
                title="إلغاء"
                onClick={() => setEditing(null)}
              >
                <X size={17} />
              </button>
            </div>
            <label>
              الاسم بالعربية
              <input name="nameAr" defaultValue={editing.nameAr} required />
            </label>
            <label>
              الاسم بالإنجليزية
              <input name="nameEn" defaultValue={editing.nameEn} dir="ltr" required />
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
        <form className="editor-panel form" onSubmit={submit}>
          <div className="section-title">
            <Plus size={18} />
            <h2>إضافة {labels[kind].singular}</h2>
          </div>
          {kind === 'courses' && (
            <label>
              السنة الدراسية
              <select
                value={selectedYearId}
                onChange={(event) => setSelectedYearId(event.target.value)}
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
          )}
          {kind !== 'years' && (
            <label>
              {kind === 'courses'
                ? 'الفصل الدراسي'
                : kind === 'sections'
                  ? 'المادة'
                  : kind === 'content-types'
                    ? 'القسم'
                    : 'السنة الدراسية'}
              <select name={parentKey} required disabled={kind === 'courses' && !selectedYearId}>
                <option value="">
                  {kind === 'courses' && !selectedYearId ? 'اختر السنة أولًا' : 'اختر'}
                </option>
                {visibleParents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'years' && (
            <label>
              رقم السنة
              <input name="number" type="number" min="1" required />
            </label>
          )}
          <label>
            الاسم بالعربية
            <input name="nameAr" required />
          </label>
          <label>
            الاسم بالإنجليزية
            <input name="nameEn" dir="ltr" required />
          </label>
          <label>
            ترتيب العرض
            <input name="displayOrder" type="number" min="0" required />
          </label>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
          <button className="primary" type="submit">
            <Plus size={17} />
            حفظ
          </button>
        </form>
      </section>
    </main>
  );
}
