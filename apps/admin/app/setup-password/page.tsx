import { SetupPasswordForm } from './setup-password-form';
export default function SetupPasswordPage() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">إعداد الحساب</p>
        <h1>اختيار كلمة المرور</h1>
        <p className="muted">
          ألصق بيانات الإعداد التي سلّمها لك المشرف العام. لا تُرسل هذه القيمة في رابط.
        </p>
        <SetupPasswordForm />
      </section>
    </main>
  );
}
