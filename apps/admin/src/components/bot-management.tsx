'use client';
import { ImagePlus, Megaphone, Save, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi } from '../lib/client-api';

type Data = {
  welcomeMessage: string;
  hasWelcomePhoto: boolean;
  years: Array<{ id: string; nameAr: string }>;
  recent: Array<{
    id: string;
    message: string;
    targetYearIds: string[];
    status: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
  }>;
};
const statusLabel: Record<string, string> = {
  QUEUED: 'بانتظار الإرسال',
  PROCESSING: 'جارٍ الإرسال',
  COMPLETED: 'مكتمل',
  FAILED: 'فشل',
};
export function BotManagement({ initial }: { initial: Data }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function saveWelcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await clientApi('announcements/welcome', { method: 'POST', body: new FormData(form) });
      setMessage('تم حفظ رسالة وصورة البدء. أرسل /start للبوت لمعاينتها.');
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ إعدادات البدء.');
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const yearIds = data.getAll('yearIds').map(String);
    const target = yearIds.length ? `طلاب ${yearIds.length} سنة محددة` : 'جميع مستخدمي البوت';
    if (!confirm(`سيتم إرسال الإعلان إلى ${target}. هل تريد المتابعة؟`)) return;
    setBusy(true);
    try {
      await clientApi('announcements', {
        method: 'POST',
        body: JSON.stringify({
          message: data.get('message'),
          yearIds,
          useWelcomePhoto: data.get('useWelcomePhoto') === 'on',
        }),
      });
      setMessage('تمت إضافة الإعلان إلى طابور الإرسال.');
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر جدولة الإعلان.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">إدارة التواصل</p>
          <h1>البوت والإعلانات</h1>
          <p className="muted">تحكم برسالة البدء وأرسل إعلانات عامة أو مخصصة حسب السنة.</p>
        </div>
      </header>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="workspace-grid">
        <form className="editor-panel form" onSubmit={saveWelcome}>
          <div className="section-title">
            <ImagePlus size={18} />
            <h2>رسالة البدء</h2>
          </div>
          <label>
            نص الترحيب
            <textarea
              name="message"
              rows={6}
              defaultValue={initial.welcomeMessage}
              maxLength={1024}
              required
            />
          </label>
          <label>
            صورة الترحيب (اختياري)
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
          </label>
          {initial.hasWelcomePhoto && (
            <label className="checkbox-line">
              <input name="removePhoto" type="checkbox" value="true" /> إزالة الصورة الحالية
            </label>
          )}
          <button className="primary" disabled={busy}>
            <Save size={17} />
            حفظ إعدادات البدء
          </button>
        </form>
        <form className="editor-panel form" onSubmit={send}>
          <div className="section-title">
            <Megaphone size={18} />
            <h2>إعلان جديد</h2>
          </div>
          <label>
            نص الإعلان
            <textarea name="message" rows={7} maxLength={1024} required />
          </label>
          <fieldset>
            <legend>الطلاب المستهدفون</legend>
            <p className="muted">عدم تحديد سنة يعني الإرسال لجميع مستخدمي البوت.</p>
            <div className="permission-grid">
              {initial.years.map((year) => (
                <label className="checkbox-line" key={year.id}>
                  <input name="yearIds" type="checkbox" value={year.id} />
                  {year.nameAr}
                </label>
              ))}
            </div>
          </fieldset>
          {initial.hasWelcomePhoto && (
            <label className="checkbox-line">
              <input name="useWelcomePhoto" type="checkbox" /> إرفاق صورة الترحيب
            </label>
          )}
          <button className="primary" disabled={busy}>
            <Send size={17} />
            إرسال الإعلان
          </button>
        </form>
      </section>
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الإعلان</th>
              <th>الاستهداف</th>
              <th>الحالة</th>
              <th>النتيجة</th>
            </tr>
          </thead>
          <tbody>
            {initial.recent.map((item) => (
              <tr key={item.id}>
                <td>{item.message.slice(0, 100)}</td>
                <td>{item.targetYearIds.length ? `${item.targetYearIds.length} سنة` : 'الجميع'}</td>
                <td>
                  <span className="badge">{statusLabel[item.status] ?? item.status}</span>
                </td>
                <td>
                  {item.sentCount} ناجح / {item.failedCount} فشل
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
