'use client';
import { Archive, Paperclip, Plus, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi, clientUpload } from '../lib/client-api';
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
const contentTypeLabels = { TEXT: 'نص', LINK: 'رابط', FILE: 'ملف' } as const;
const stateLabels = { DRAFT: 'مسودة', PUBLISHED: 'منشور', ARCHIVED: 'مؤرشف' } as const;
export function ContentManager({ items, sections }: { items: Item[]; sections: Section[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
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
  async function upload(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setUploadProgress((current) => ({ ...current, [id]: 0 }));
      const { ticket } = await clientApi<{ ticket: string }>(`content/${id}/upload-ticket`, {
        method: 'POST',
      });
      await clientUpload(
        `content-upload/${id}`,
        data,
        (value) => setUploadProgress((current) => ({ ...current, [id]: value })),
        ticket,
      );
      setMessage('تم رفع الملف وحفظه في مستودع Telegram.');
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر رفع الملف.');
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
      <section className="workspace-grid content-workspace">
        <div className="content-list">
          {items.map((item) => (
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
              <div className="row-actions">
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
                  className="icon-button danger"
                  title="أرشفة"
                  onClick={() => void state(item.id, 'ARCHIVED')}
                >
                  <Archive size={17} />
                </button>
              </div>
              {item.contentType === 'FILE' && (
                <form className="inline-upload" onSubmit={(event) => void upload(item.id, event)}>
                  <label>
                    <Paperclip size={16} />
                    <span>إرفاق ملف</span>
                    <input
                      name="file"
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*,audio/*,video/mp4,video/webm"
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
            </article>
          ))}
          {!items.length && (
            <div className="empty-state">لا يوجد محتوى بعد. ابدأ من النموذج المجاور.</div>
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
