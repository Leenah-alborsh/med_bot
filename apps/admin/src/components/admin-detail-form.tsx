'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

interface Admin {
  id: string;
  email: string;
  displayNameAr: string;
  displayNameEn: string;
  status: string;
  roles: Array<{ id: string }>;
  scopes: Array<{ botId?: string; academicYearId?: string; courseId?: string }>;
}
interface Role {
  id: string;
  nameAr: string;
}
export function AdminDetailForm({
  admin,
  roles,
  currentAdminId,
}: {
  admin: Admin;
  roles: Role[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [secret, setSecret] = useState('');
  const run = async (path: string, body?: unknown) => {
    setMessage('');
    try {
      await clientApi(path, {
        method: body ? 'POST' : 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setMessage('تم حفظ التغييرات');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إتمام الطلب');
    }
  };
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await clientApi(`admins/${admin.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: data.get('email'),
          displayNameAr: data.get('displayNameAr'),
          displayNameEn: data.get('displayNameEn'),
        }),
      });
      setMessage('تم تحديث البيانات');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر التحديث');
    }
  }
  async function assignRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(`admins/${admin.id}/roles`, { roleIds: data.getAll('roleIds') });
  }
  async function assignScopes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ids = (name: string) => {
      const value = data.get(name);
      return (typeof value === 'string' ? value : '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    };
    await run(`admins/${admin.id}/scopes`, {
      botIds: ids('botIds'),
      academicYearIds: ids('academicYearIds'),
      courseIds: ids('courseIds'),
    });
  }
  async function regenerate() {
    try {
      const result = await clientApi<{ token: string }>(`admins/${admin.id}/setup-credential`, {
        method: 'POST',
      });
      setSecret(result.token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر الإصدار');
    }
  }
  return (
    <div className="stack">
      <form className="form form-grid" onSubmit={update}>
        <h2>بيانات الحساب</h2>
        <label>
          البريد
          <input name="email" type="email" defaultValue={admin.email} required />
        </label>
        <label>
          الاسم بالعربية
          <input name="displayNameAr" defaultValue={admin.displayNameAr} required />
        </label>
        <label>
          الاسم بالإنجليزية
          <input name="displayNameEn" defaultValue={admin.displayNameEn} required />
        </label>
        <button className="primary" type="submit">
          حفظ البيانات
        </button>
      </form>
      <form className="form" onSubmit={assignRoles}>
        <h2>الأدوار</h2>
        {roles.map((role) => (
          <label className="check" key={role.id}>
            <input
              name="roleIds"
              type="checkbox"
              value={role.id}
              defaultChecked={admin.roles.some((item) => item.id === role.id)}
            />
            {role.nameAr}
          </label>
        ))}
        <button type="submit">حفظ الأدوار</button>
      </form>
      <form className="form" onSubmit={assignScopes}>
        <h2>النطاقات</h2>
        <p className="muted">
          أدخل المعرّفات مفصولة بفواصل. ترك جميع الحقول فارغة يمنح نطاقاً عاماً للإجراءات المسموحة.
        </p>
        <label>
          معرّفات البوتات
          <input
            name="botIds"
            defaultValue={admin.scopes
              .map((scope) => scope.botId)
              .filter(Boolean)
              .join(', ')}
          />
        </label>
        <label>
          معرّفات السنوات
          <input
            name="academicYearIds"
            defaultValue={admin.scopes
              .map((scope) => scope.academicYearId)
              .filter(Boolean)
              .join(', ')}
          />
        </label>
        <label>
          معرّفات المقررات
          <input
            name="courseIds"
            defaultValue={admin.scopes
              .map((scope) => scope.courseId)
              .filter(Boolean)
              .join(', ')}
          />
        </label>
        <button type="submit">حفظ النطاقات</button>
      </form>
      <section>
        <h2>إجراءات الحساب</h2>
        <div className="actions">
          {admin.id !== currentAdminId && (
            <button
              className={admin.status === 'DISABLED' ? 'primary' : 'danger'}
              type="button"
              onClick={() =>
                run(`admins/${admin.id}/status`, { active: admin.status === 'DISABLED' })
              }
            >
              {admin.status === 'DISABLED' ? 'إعادة التفعيل' : 'تعطيل الحساب'}
            </button>
          )}
          <button type="button" onClick={() => run(`admins/${admin.id}/revoke-sessions`)}>
            إلغاء الجلسات
          </button>
          <button type="button" onClick={regenerate}>
            إصدار بيانات إعداد جديدة
          </button>
        </div>
        {secret && (
          <div className="secret-notice">
            <strong>تظهر مرة واحدة فقط</strong>
            <code>{secret}</code>
          </div>
        )}
      </section>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
