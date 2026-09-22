'use client';

import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clientApi } from '../../src/lib/client-api';

export function LoginForm({ setupComplete = false }: { setupComplete?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      await clientApi('auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {setupComplete && (
        <p className="notice">تم تفعيل الحساب. سجّل الدخول بالبريد وكلمة المرور الجديدة.</p>
      )}
      <form className="form" onSubmit={submit}>
        <label>
          البريد الإلكتروني
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          كلمة المرور
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={loading} type="submit">
          <LogIn size={17} />
          {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
        </button>
      </form>
    </>
  );
}
