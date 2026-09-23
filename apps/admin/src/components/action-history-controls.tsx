'use client';

import { Redo2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '../lib/client-api';

type Status = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
};

export function ActionHistoryControls() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
  });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setStatus(await clientApi<Status>('audit/actions'));
    } catch {
      /* Hidden when unavailable. */
    }
  }, []);
  useEffect(() => {
    const handleAction = () => void load();
    void load();
    window.addEventListener('admin-action-completed', handleAction);
    return () => window.removeEventListener('admin-action-completed', handleAction);
  }, [load]);

  async function run(action: 'undo' | 'redo') {
    setBusy(true);
    try {
      setStatus(await clientApi<Status>(`audit/actions/${action}`, { method: 'POST' }));
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر تنفيذ العملية.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="action-history-controls" aria-label="التراجع والتقدم">
      <button
        className="icon-button"
        type="button"
        title={status.undoLabel ?? 'لا توجد عملية للتراجع'}
        disabled={busy || !status.canUndo}
        onClick={() => void run('undo')}
      >
        <Undo2 size={18} />
      </button>
      <button
        className="icon-button"
        type="button"
        title={status.redoLabel ?? 'لا توجد عملية للتقدم'}
        disabled={busy || !status.canRedo}
        onClick={() => void run('redo')}
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
}
