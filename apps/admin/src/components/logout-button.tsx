'use client';

import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-button"
      type="button"
      onClick={async () => {
        await clientApi('auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
      }}
    >
      تسجيل الخروج
    </button>
  );
}
