'use client';
import { useState, type FormEvent } from 'react';
import { Archive, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

type Item = { id: string; nameAr: string; nameEn: string; displayOrder: number; isActive: boolean };
type Option = { id: string; nameAr: string; academicYearId?: string };
type Kind = 'years' | 'semesters' | 'courses' | 'sections';
const labels: Record<Kind, { title: string; singular: string }> = {
  years: {
    title: 'السنوات الدراسية',
    singular: 'سنة دراسية',
  },
  semesters: { title: 'الفصول', singular: 'فصل' },
  courses: { title: 'المواد', singular: 'مادة' },
  sections: { title: 'الأقسام', singular: 'قسم' },
};
export function CatalogManager({
  kind,
  items,
  parents = [],
  years = [],
}: {
  kind: Kind;
  items: Item[];
  parents?: Option[];
  years?: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const visibleParents =
    kind === 'courses'
      ? parents.filter((parent) => parent.academicYearId === selectedYearId)
      : parents;
  const parentKey =
    kind === 'semesters' ? 'academicYearId' : kind === 'courses' ? 'semesterId' : 'courseId';
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
  async function archive(id: string) {
    if (!confirm('هل تريد أرشفة هذا العنصر؟')) return;
    try {
      await clientApi(`catalog/${kind.slice(0, -1)}/${id}/archive`, { method: 'POST' });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت الأرشفة.');
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
              {items.map((item) => (
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
                    <button
                      className="icon-button danger"
                      title="أرشفة"
                      onClick={() => void archive(item.id)}
                      disabled={!item.isActive}
                    >
                      <Archive size={17} />
                    </button>
                    <button
                      className="icon-button danger"
                      title={item.isActive ? 'أرشف العنصر أولًا' : 'حذف نهائي'}
                      onClick={() => void remove(item.id)}
                      disabled={item.isActive}
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div className="empty-state">لا توجد عناصر حتى الآن.</div>}
        </div>
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
              {kind === 'courses' ? 'الفصل الدراسي' : 'العنصر الأب'}
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
