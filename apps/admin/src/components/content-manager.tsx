'use client';
import { Archive, Paperclip, Plus, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi } from '../lib/client-api';
type Item = {
  id: string;
  titleAr: string;
  titleEn?: string;
  contentType: 'TEXT' | 'LINK' | 'FILE';
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  displayOrder: number;
  section: { nameAr: string; course: { nameAr: string } };
  attachments: Array<{ id: string }>;
};
type Section = { id: string; nameAr: string };
export function ContentManager({ items, sections }: { items: Item[]; sections: Section[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
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
      setMessage(
        '\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0643\u0645\u0633\u0648\u062f\u0629.',
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u062d\u062a\u0648\u0649.',
      );
    }
  }
  async function state(id: string, next: 'PUBLISHED' | 'ARCHIVED') {
    if (
      next === 'ARCHIVED' &&
      !confirm(
        '\u0647\u0644 \u062a\u0631\u064a\u062f \u0623\u0631\u0634\u0641\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u062d\u062a\u0648\u0649\u061f',
      )
    )
      return;
    try {
      await clientApi(`content/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: next }),
      });
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629.',
      );
    }
  }
  async function upload(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await clientApi(`content/${id}/attachments/upload`, { method: 'POST', body: data });
      setMessage('\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '\u062a\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641.',
      );
    }
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            \u0627\u0644\u0645\u0643\u062a\u0628\u0629
            \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a\u0629
          </p>
          <h1>
            \u0627\u0644\u0645\u062d\u062a\u0648\u0649
            \u0648\u0627\u0644\u0645\u0644\u0641\u0627\u062a
          </h1>
          <p className="muted">
            \u0623\u0646\u0634\u0626 \u0627\u0644\u0645\u062d\u062a\u0648\u0649\u060c
            \u0623\u0631\u0641\u0642 \u0645\u0648\u0627\u0631\u062f\u0647\u060c \u062b\u0645
            \u0627\u0646\u0634\u0631\u0647 \u0644\u0644\u0637\u0644\u0627\u0628.
          </p>
        </div>
      </header>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="workspace-grid content-workspace">
        <div className="content-list">
          {items.map((item) => (
            <article className="content-row" key={item.id}>
              <div>
                <div className="row-title">
                  <strong>{item.titleAr}</strong>
                  <span className="badge" data-state={item.state.toLowerCase()}>
                    {item.state}
                  </span>
                </div>
                <span className="muted">
                  {item.section.course.nameAr} / {item.section.nameAr} \u00b7 {item.contentType}
                </span>
              </div>
              <div className="row-actions">
                {item.state !== 'PUBLISHED' && (
                  <button
                    className="icon-button success"
                    title="\u0646\u0634\u0631"
                    onClick={() => void state(item.id, 'PUBLISHED')}
                  >
                    <Send size={17} />
                  </button>
                )}
                <button
                  className="icon-button danger"
                  title="\u0623\u0631\u0634\u0641\u0629"
                  onClick={() => void state(item.id, 'ARCHIVED')}
                >
                  <Archive size={17} />
                </button>
              </div>
              {item.contentType === 'FILE' && (
                <form className="inline-upload" onSubmit={(event) => void upload(item.id, event)}>
                  <label>
                    <Paperclip size={16} />
                    <span>\u0625\u0631\u0641\u0627\u0642 \u0645\u0644\u0641</span>
                    <input name="file" type="file" required />
                  </label>
                  <button type="submit">\u0631\u0641\u0639</button>
                </form>
              )}
            </article>
          ))}
          {!items.length && (
            <div className="empty-state">
              \u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062d\u062a\u0648\u0649
              \u0628\u0639\u062f. \u0627\u0628\u062f\u0623 \u0645\u0646
              \u0627\u0644\u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0645\u062c\u0627\u0648\u0631.
            </div>
          )}
        </div>
        <form className="editor-panel form" onSubmit={create}>
          <div className="section-title">
            <Plus size={18} />
            <h2>\u0645\u062d\u062a\u0648\u0649 \u062c\u062f\u064a\u062f</h2>
          </div>
          <label>
            \u0627\u0644\u0642\u0633\u0645
            <select name="sectionId" required>
              <option value="">\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </select>
          </label>
          <label>
            \u0627\u0644\u0639\u0646\u0648\u0627\u0646
            \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629
            <input name="titleAr" required />
          </label>
          <label>
            \u0627\u0644\u0639\u0646\u0648\u0627\u0646
            \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629
            <input name="titleEn" dir="ltr" />
          </label>
          <label>
            \u0627\u0644\u0646\u0648\u0639
            <select name="contentType" required>
              <option value="TEXT">\u0646\u0635</option>
              <option value="LINK">\u0631\u0627\u0628\u0637</option>
              <option value="FILE">\u0645\u0644\u0641</option>
            </select>
          </label>
          <label>
            \u0627\u0644\u0646\u0635 \u0623\u0648 \u0627\u0644\u0648\u0635\u0641
            <textarea name="bodyText" rows={5} />
          </label>
          <label>
            \u0631\u0627\u0628\u0637 HTTPS (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)
            <input name="externalUrl" type="url" dir="ltr" placeholder="https://" />
          </label>
          <label>
            \u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0639\u0631\u0636
            <input name="displayOrder" type="number" min="0" required />
          </label>
          <button className="primary" type="submit">
            <Plus size={17} />
            \u062d\u0641\u0638 \u0643\u0645\u0633\u0648\u062f\u0629
          </button>
        </form>
      </section>
    </main>
  );
}
