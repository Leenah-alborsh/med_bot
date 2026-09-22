import { SetupPasswordForm } from './setup-password-form';

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">دعوة مشرف جديد</p>
        <h1>إعداد كلمة المرور</h1>
        <p className="muted">
          اختر كلمة مرور خاصة بك. رابط الدعوة صالح لمرة واحدة فقط، وبعدها يمكنك الدخول من صفحة
          الإدارة المعتادة.
        </p>
        <SetupPasswordForm token={token} />
      </section>
    </main>
  );
}
