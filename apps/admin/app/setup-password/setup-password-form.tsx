'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { clientApi } from '../../src/lib/client-api';

export function SetupPasswordForm({ token }: { token?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmation')) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await clientApi('auth/setup-password', {
        method: 'POST',
        body: JSON.stringify({ token: token ?? data.get('token'), password: data.get('password') }),
      });
      router.replace('/login?setup=success');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'تعذر إعداد الحساب. قد يكون الرابط منتهيًا.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {!token && (
        <label>
          رمز الدعوة
          <input name="token" type="password" autoComplete="off" required />
        </label>
      )}
      <label>
        كلمة المرور الجديدة
        <input
          name="password"
          type="password"
          minLength={12}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        تأكيد كلمة المرور
        <input
          name="confirmation"
          type="password"
          minLength={12}
          autoComplete="new-password"
          required
        />
      </label>
      <p className="muted">12 حرفًا على الأقل، وتتضمن حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={loading} type="submit">
        <KeyRound size={17} />
        {loading ? 'جارٍ تفعيل الحساب...' : 'تعيين كلمة المرور وتفعيل الحساب'}
      </button>
    </form>
  );
}
