'use client';

import { useRouter } from 'next/navigation';
import { clientApi } from '../lib/client-api';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-button"
      type="button"
      title="تسجيل الخروج"
      aria-label="تسجيل الخروج"
      onClick={async () => {
        await clientApi('auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
      }}
    >
      <LogOut size={18} />
      <span className="sr-only">تسجيل الخروج</span>
    </button>
  );
}
