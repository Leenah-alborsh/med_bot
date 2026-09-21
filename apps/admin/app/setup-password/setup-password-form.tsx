'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../../src/lib/client-api';
export function SetupPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmation')) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      await clientApi('auth/setup-password', {
        method: 'POST',
        body: JSON.stringify({ token: data.get('token'), password: data.get('password') }),
      });
      router.replace('/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إعداد الحساب');
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <label>
        بيانات الإعداد لمرة واحدة
        <input name="token" type="password" autoComplete="off" required />
      </label>
      <label>
        كلمة المرور الجديدة
        <input name="password" type="password" minLength={12} required />
      </label>
      <label>
        تأكيد كلمة المرور
        <input name="confirmation" type="password" minLength={12} required />
      </label>
      <p className="muted">12 حرفاً على الأقل، وتتضمن حرفاً كبيراً وصغيراً ورقماً ورمزاً.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={loading} type="submit">
        {loading ? 'جارٍ الحفظ...' : 'إعداد الحساب'}
      </button>
    </form>
  );
}
