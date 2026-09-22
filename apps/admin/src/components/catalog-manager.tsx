'use client';
import { useState, type FormEvent } from 'react';
import { Archive, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

type Item = { id: string; nameAr: string; nameEn: string; displayOrder: number; isActive: boolean };
type Option = { id: string; nameAr: string };
type Kind = 'years' | 'semesters' | 'courses' | 'sections';
const labels: Record<Kind, { title: string; singular: string }> = {
  years: {
    title:
      '\u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0627\u0644\u062f\u0631\u0627\u0633\u064a\u0629',
    singular: '\u0633\u0646\u0629 \u062f\u0631\u0627\u0633\u064a\u0629',
  },
  semesters: { title: '\u0627\u0644\u0641\u0635\u0648\u0644', singular: '\u0641\u0635\u0644' },
  courses: { title: '\u0627\u0644\u0645\u0648\u0627\u062f', singular: '\u0645\u0627\u062f\u0629' },
  sections: { title: '\u0627\u0644\u0623\u0642\u0633\u0627\u0645', singular: '\u0642\u0633\u0645' },
};
export function CatalogManager({
  kind,
  items,
  parents = [],
}: {
  kind: Kind;
  items: Item[];
  parents?: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
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
      setMessage('\u062a\u0645 \u0627\u0644\u062d\u0641\u0638 \u0628\u0646\u062c\u0627\u062d.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '\u062a\u0639\u0630\u0631 \u0627\u0644\u062d\u0641\u0638.',
      );
    }
  }
  async function archive(id: string) {
    if (
      !confirm(
        '\u0647\u0644 \u062a\u0631\u064a\u062f \u0623\u0631\u0634\u0641\u0629 \u0647\u0630\u0627 \u0627\u0644\u0639\u0646\u0635\u0631\u061f',
      )
    )
      return;
    try {
      await clientApi(`catalog/${kind.slice(0, -1)}/${id}/archive`, { method: 'POST' });
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '\u062a\u0639\u0630\u0631\u062a \u0627\u0644\u0623\u0631\u0634\u0641\u0629.',
      );
    }
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            \u0627\u0644\u0647\u064a\u0643\u0644
            \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a
          </p>
          <h1>{labels[kind].title}</h1>
          <p className="muted">
            \u0625\u062f\u0627\u0631\u0629 \u0645\u0631\u062a\u0628\u0629
            \u0648\u0622\u0645\u0646\u0629 \u0644\u0644\u0645\u0633\u0627\u0631
            \u0627\u0644\u0630\u064a \u064a\u0638\u0647\u0631 \u0644\u0644\u0637\u0644\u0627\u0628.
          </p>
        </div>
      </header>
      <section className="workspace-grid">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>\u0627\u0644\u0627\u0633\u0645</th>
                <th>English</th>
                <th>\u0627\u0644\u062a\u0631\u062a\u064a\u0628</th>
                <th>\u0627\u0644\u062d\u0627\u0644\u0629</th>
                <th>
                  <span className="sr-only">
                    \u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a
                  </span>
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
                      {item.isActive ? '\u0646\u0634\u0637' : '\u0645\u0624\u0631\u0634\u0641'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button danger"
                      title="\u0623\u0631\u0634\u0641\u0629"
                      onClick={() => void archive(item.id)}
                      disabled={!item.isActive}
                    >
                      <Archive size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="empty-state">
              \u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0646\u0627\u0635\u0631
              \u062d\u062a\u0649 \u0627\u0644\u0622\u0646.
            </div>
          )}
        </div>
        <form className="editor-panel form" onSubmit={submit}>
          <div className="section-title">
            <Plus size={18} />
            <h2>\u0625\u0636\u0627\u0641\u0629 {labels[kind].singular}</h2>
          </div>
          {kind !== 'years' && (
            <label>
              \u0627\u0644\u0639\u0646\u0635\u0631 \u0627\u0644\u0623\u0628
              <select name={parentKey} required>
                <option value="">\u0627\u062e\u062a\u0631</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'years' && (
            <label>
              \u0631\u0642\u0645 \u0627\u0644\u0633\u0646\u0629
              <input name="number" type="number" min="1" required />
            </label>
          )}
          <label>
            \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629
            <input name="nameAr" required />
          </label>
          <label>
            \u0627\u0644\u0627\u0633\u0645
            \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629
            <input name="nameEn" dir="ltr" required />
          </label>
          <label>
            \u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0639\u0631\u0636
            <input name="displayOrder" type="number" min="0" required />
          </label>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
          <button className="primary" type="submit">
            <Plus size={17} />
            \u062d\u0641\u0638
          </button>
        </form>
      </section>
    </main>
  );
}
