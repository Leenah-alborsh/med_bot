'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '../lib/client-api';

export function AdminDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm(`سيتم حذف حساب المشرف ${name} نهائيًا وإلغاء جلساته. هل أنت متأكد؟`)) return;
    setDeleting(true);
    try {
      await clientApi(`admins/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر حذف حساب المشرف.');
      setDeleting(false);
    }
  }

  return (
    <button
      className="icon-button danger"
      type="button"
      title="حذف المشرف"
      aria-label={`حذف المشرف ${name}`}
      disabled={deleting}
      onClick={() => void remove()}
    >
      <Trash2 size={17} />
    </button>
  );
}
