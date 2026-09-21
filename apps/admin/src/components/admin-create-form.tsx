'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

interface Role {
  id: string;
  nameAr: string;
  nameEn: string;
}
export function AdminCreateForm({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<{ token: string; expiresAt: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await clientApi<{ setupCredential: { token: string; expiresAt: string } }>(
        'admins',
        {
          method: 'POST',
          body: JSON.stringify({
            email: data.get('email'),
            displayNameAr: data.get('displayNameAr'),
            displayNameEn: data.get('displayNameEn'),
            roleIds: data.getAll('roleIds'),
          }),
        },
      );
      setSetup(result.setupCredential);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إنشاء الحساب');
    }
  }
  return (
    <section>
      <h2>إضافة مشرف ثانوي</h2>
      <form className="form form-grid" onSubmit={submit}>
        <label>
          البريد الإلكتروني
          <input name="email" type="email" required />
        </label>
        <label>
          الاسم بالعربية
          <input name="displayNameAr" required />
        </label>
        <label>
          الاسم بالإنجليزية
          <input name="displayNameEn" required />
        </label>
        <fieldset>
          <legend>الأدوار المتاحة</legend>
          {roles.map((role) => (
            <label className="check" key={role.id}>
              <input name="roleIds" type="checkbox" value={role.id} />
              {role.nameAr} ({role.nameEn})
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          إنشاء الحساب
        </button>
      </form>
      {setup && (
        <div className="secret-notice" role="status">
          <strong>بيانات الإعداد لمرة واحدة</strong>
          <p>
            لن تظهر هذه القيمة مرة أخرى. تنتهي في {new Date(setup.expiresAt).toLocaleString('ar')}.
          </p>
          <code>{setup.token}</code>
          <a href="/setup-password">فتح صفحة إعداد كلمة المرور</a>
        </div>
      )}
    </section>
  );
}
