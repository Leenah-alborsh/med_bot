'use client';
import { CheckCircle, Eye, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '../lib/client-api';
const statusLabels: Record<string, string> = {
  OPEN: 'مفتوح',
  REVIEWED: 'تمت مراجعته',
  RESOLVED: 'محلول',
  DISMISSED: 'مرفوض',
};
type Report = {
  id: string;
  status: string;
  reasonCategory?: string;
  createdAt: string;
  contentItem: { titleAr: string; section: { nameAr: string; course: { nameAr: string } } };
  attachment?: { originalFilename: string };
};
export function ReportsTable({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  async function update(id: string, status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED') {
    const resolutionNote = prompt('ملاحظة المعالجة (اختيارية)') ?? undefined;
    try {
      await clientApi(`broken-file-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolutionNote }),
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحديث البلاغ.');
    }
  }
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>المحتوى</th>
              <th>الملف</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.contentItem.titleAr}</strong>
                  <span className="table-subtitle">
                    {r.contentItem.section.course.nameAr} / {r.contentItem.section.nameAr}
                  </span>
                </td>
                <td>{r.attachment?.originalFilename ?? '—'}</td>
                <td>
                  <span className="badge">{statusLabels[r.status] ?? r.status}</span>
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar')}</td>
                <td className="row-actions">
                  <button
                    className="icon-button"
                    title="تمت المراجعة"
                    onClick={() => void update(r.id, 'REVIEWED')}
                  >
                    <Eye size={17} />
                  </button>
                  <button
                    className="icon-button success"
                    title="تم الحل"
                    onClick={() => void update(r.id, 'RESOLVED')}
                  >
                    <CheckCircle size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    title="رفض"
                    onClick={() => void update(r.id, 'DISMISSED')}
                  >
                    <XCircle size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!reports.length && <div className="empty-state">لا توجد بلاغات ملفات حالياً.</div>}
      </div>
    </>
  );
}
