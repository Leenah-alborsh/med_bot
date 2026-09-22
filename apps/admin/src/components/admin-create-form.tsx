'use client';

import { Check, Copy, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

interface Role {
  id: string;
  nameAr: string;
  nameEn: string;
}
type Invitation = { link: string; email: string; expiresAt: string };

export function AdminCreateForm({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInvitation(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawEmail = data.get('email');
    const email = typeof rawEmail === 'string' ? rawEmail : '';
    try {
      const result = await clientApi<{ setupCredential: { token: string; expiresAt: string } }>(
        'admins',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            displayNameAr: data.get('displayNameAr'),
            displayNameEn: data.get('displayNameEn'),
            roleIds: data.getAll('roleIds'),
          }),
        },
      );
      const link = `${window.location.origin}/setup-password?token=${encodeURIComponent(result.setupCredential.token)}`;
      setInvitation({ link, email, expiresAt: result.setupCredential.expiresAt });
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إنشاء الحساب.');
    }
  }

  async function copyInvitation() {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.link);
    setCopied(true);
  }

  return (
    <section className="admin-create">
      <div className="section-title">
        <UserPlus size={19} />
        <h2>إضافة مشرف جديد</h2>
      </div>
      <p className="muted">
        أنشئ الحساب وحدد دوره، ثم أرسل له رابط الدعوة ليختار كلمة مروره بنفسه.
      </p>
      <form className="form form-grid" onSubmit={submit}>
        <label>
          البريد الإلكتروني
          <input name="email" type="email" autoComplete="off" required />
        </label>
        <label>
          الاسم بالعربية
          <input name="displayNameAr" required />
        </label>
        <label>
          الاسم بالإنجليزية
          <input name="displayNameEn" dir="ltr" required />
        </label>
        <fieldset>
          <legend>الصلاحيات حسب الدور</legend>
          {roles.map((role) => (
            <label className="check" key={role.id}>
              <input name="roleIds" type="checkbox" value={role.id} />
              {role.nameAr} <span className="muted">({role.nameEn})</span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          <UserPlus size={17} /> إنشاء الحساب وإصدار الدعوة
        </button>
      </form>
      {invitation && (
        <div className="invitation-panel" role="status">
          <div>
            <Check size={20} />
            <strong>تم إنشاء الحساب، وبانتظار تفعيل المشرف</strong>
          </div>
          <p>
            أرسل هذا الرابط إلى <bdi>{invitation.email}</bdi>. سيختار كلمة مروره ثم يسجل الدخول.
          </p>
          <div className="invitation-link">
            <input readOnly dir="ltr" value={invitation.link} />
            <button type="button" onClick={copyInvitation}>
              <Copy size={17} /> {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </button>
          </div>
          <small>
            ينتهي الرابط في {new Date(invitation.expiresAt).toLocaleString('ar')} ويعمل مرة واحدة
            فقط.
          </small>
          <a className="secondary-link" href={invitation.link} target="_blank" rel="noreferrer">
            فتح صفحة التفعيل للتجربة
          </a>
        </div>
      )}
    </section>
  );
}
