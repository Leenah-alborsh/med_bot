'use client';

import { Copy, KeyRound } from 'lucide-react';
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
interface ScopeOption {
  id: string;
  nameAr: string;
}

export function AdminDetailForm({
  admin,
  roles,
  years,
  courses,
  currentAdminId,
}: {
  admin: Admin;
  roles: Role[];
  years: ScopeOption[];
  courses: ScopeOption[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [invitation, setInvitation] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (path: string, body?: unknown) => {
    setMessage('');
    try {
      await clientApi(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      setMessage('تم حفظ التغييرات.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إتمام الطلب.');
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
      setMessage('تم تحديث بيانات الحساب.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر التحديث.');
    }
  }
  async function assignRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(`admins/${admin.id}/roles`, {
      roleIds: new FormData(event.currentTarget).getAll('roleIds'),
    });
  }
  async function assignScopes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(`admins/${admin.id}/scopes`, {
      botIds: [],
      academicYearIds: data.getAll('academicYearIds'),
      courseIds: data.getAll('courseIds'),
    });
  }
  async function regenerate() {
    try {
      const result = await clientApi<{ token: string; expiresAt: string }>(
        `admins/${admin.id}/setup-credential`,
        { method: 'POST' },
      );
      setInvitation({
        link: `${window.location.origin}/setup-password?token=${encodeURIComponent(result.token)}`,
        expiresAt: result.expiresAt,
      });
      setCopied(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إصدار الدعوة.');
    }
  }
  async function copyInvitation() {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.link);
    setCopied(true);
  }

  return (
    <div className="stack">
      <form className="form form-grid" onSubmit={update}>
        <h2>بيانات الحساب</h2>
        <label>
          البريد الإلكتروني
          <input name="email" type="email" defaultValue={admin.email} required />
        </label>
        <label>
          الاسم بالعربية
          <input name="displayNameAr" defaultValue={admin.displayNameAr} required />
        </label>
        <label>
          الاسم بالإنجليزية
          <input name="displayNameEn" defaultValue={admin.displayNameEn} dir="ltr" required />
        </label>
        <button className="primary" type="submit">
          حفظ البيانات
        </button>
      </form>
      <form className="form" onSubmit={assignRoles}>
        <h2>الأدوار والصلاحيات</h2>
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
      <form className="form scope-editor" onSubmit={assignScopes}>
        <h2>نطاق البيانات</h2>
        <p className="muted">
          عدم اختيار أي نطاق يعني أن المشرف يرى كل البيانات التي يسمح بها دوره. اختر سنوات أو مواد
          لتقييد ما يظهر له.
        </p>
        <fieldset>
          <legend>السنوات المسموحة</legend>
          <div className="scope-options">
            {years.map((year) => (
              <label className="check" key={year.id}>
                <input
                  name="academicYearIds"
                  type="checkbox"
                  value={year.id}
                  defaultChecked={admin.scopes.some((scope) => scope.academicYearId === year.id)}
                />
                {year.nameAr}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>المواد المسموحة</legend>
          <div className="scope-options">
            {courses.map((course) => (
              <label className="check" key={course.id}>
                <input
                  name="courseIds"
                  type="checkbox"
                  value={course.id}
                  defaultChecked={admin.scopes.some((scope) => scope.courseId === course.id)}
                />
                {course.nameAr}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit">حفظ نطاق البيانات</button>
      </form>
      <section className="account-actions">
        <h2>الدخول والحساب</h2>
        <p className="muted">
          {admin.status === 'PENDING'
            ? 'هذا الحساب بانتظار اختيار كلمة المرور.'
            : 'يمكنك إلغاء الجلسات أو إصدار رابط إعداد جديد عند الحاجة.'}
        </p>
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
            تسجيل الخروج من كل الأجهزة
          </button>
          <button type="button" onClick={regenerate}>
            <KeyRound size={17} /> إصدار رابط دعوة جديد
          </button>
        </div>
        {invitation && (
          <div className="invitation-panel">
            <strong>رابط إعداد كلمة المرور</strong>
            <div className="invitation-link">
              <input readOnly dir="ltr" value={invitation.link} />
              <button type="button" onClick={copyInvitation}>
                <Copy size={17} />
                {copied ? 'تم النسخ' : 'نسخ الرابط'}
              </button>
            </div>
            <small>
              ينتهي في {new Date(invitation.expiresAt).toLocaleString('ar')} ويلغي أي رابط سابق.
            </small>
          </div>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
