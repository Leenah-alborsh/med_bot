import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const cookieStore = await cookies();
  if (cookieStore.has('med_admin_session')) {
    const base =
      process.env.API_INTERNAL_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:3001/api';
    const response = await fetch(`${base}/v1/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    }).catch(() => null);
    if (response?.ok) redirect('/dashboard');
  }
  const { setup } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <p className="eyebrow">Medical Students Hub</p>
        <h1 id="login-title">تسجيل دخول الإدارة</h1>
        <p className="muted">استخدم البريد الإلكتروني وكلمة المرور الخاصة بحسابك الإداري.</p>
        <LoginForm setupComplete={setup === 'success'} />
      </section>
    </main>
  );
}
