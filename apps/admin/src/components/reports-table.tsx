'use client';
import { Archive, CheckCircle, ExternalLink, Eye, Pencil, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '../lib/client-api';
const statusLabels: Record<string, string> = {
  OPEN: 'مفتوح',
  REVIEWED: 'تمت مراجعته',
  RESOLVED: 'محلول',
  DISMISSED: 'مرفوض',
};
export type Report = {
  id: string;
  status: string;
  reasonCategory?: string;
  createdAt: string;
  resolutionNote?: string | null;
  contentItem: {
    id: string;
    titleAr: string;
    state?: string;
    _count?: { attachments: number };
    section: { nameAr: string; course: { id?: string; nameAr: string } };
  };
  attachment?: { originalFilename: string; isCurrent?: boolean; previewUrl?: string | null } | null;
};
export function ReportsTable({
  reports,
  canManage,
  canArchive,
  canReadContent,
}: {
  reports: Report[];
  canManage: boolean;
  canArchive: boolean;
  canReadContent: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  async function update(id: string, status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED') {
    const resolutionNote = prompt('ملاحظة المعالجة (اختيارية)');
    if (resolutionNote === null) return;
    setError('');
    setBusy(id);
    try {
      await clientApi(`broken-file-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolutionNote }),
      });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحديث البلاغ.');
    } finally {
      setBusy(null);
    }
  }
  async function archive(report: Report) {
    if (!report.contentItem._count || !report.contentItem.state) return;
    const confirmed = confirm(
      `أرشفة «${report.contentItem.titleAr}» من البوت؟\nسيختفي المحتوى كاملاً وكل مرفقاته (${report.contentItem._count.attachments}) عن الطلاب، مع الاحتفاظ بالملفات والبلاغ وإمكانية إعادة نشره من صفحة المحتوى.`,
    );
    if (!confirmed) return;
    setError('');
    setBusy(report.id);
    try {
      await clientApi(`broken-file-reports/${report.id}/archive-content`, { method: 'POST' });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذرت أرشفة المحتوى.');
    } finally {
      setBusy(null);
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
                <td>
                  <span>{r.attachment?.originalFilename ?? '—'}</span>
                  {r.attachment?.previewUrl && (
                    <a
                      href={r.attachment.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="table-subtitle"
                      title="فتح الملف في تيليجرام؛ يتطلب عضوية قناة التخزين"
                    >
                      <ExternalLink size={15} /> فتح الملف
                    </a>
                  )}
                  {r.attachment && !r.attachment.previewUrl && (
                    <small className="table-subtitle">رابط فتح الملف غير متاح</small>
                  )}
                  {r.attachment?.isCurrent === false && (
                    <small className="table-subtitle">نسخة قديمة تم استبدالها</small>
                  )}
                </td>
                <td>
                  <span className="badge">{statusLabels[r.status] ?? r.status}</span>
                  {r.contentItem.state === 'ARCHIVED' && (
                    <small className="table-subtitle">المحتوى مؤرشف من البوت</small>
                  )}
                  {r.resolutionNote && <small className="table-subtitle">{r.resolutionNote}</small>}
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar')}</td>
                <td className="row-actions">
                  {canReadContent && (
                    <Link
                      className="icon-button"
                      href={`/content?${r.contentItem.section.course.id ? `courseId=${r.contentItem.section.course.id}&` : ''}search=${encodeURIComponent(r.contentItem.titleAr.slice(0, 100))}`}
                      title="إدارة المحتوى أو استرجاعه"
                      aria-label="إدارة المحتوى أو استرجاعه"
                    >
                      <Pencil size={17} />
                    </Link>
                  )}
                  {canManage && (
                    <>
                      <button
                        className="icon-button"
                        title="تمت المراجعة"
                        onClick={() => void update(r.id, 'REVIEWED')}
                        disabled={busy !== null}
                        aria-label="تمت المراجعة بدون إخفاء المحتوى"
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        className="icon-button success"
                        title="تم الحل"
                        onClick={() => void update(r.id, 'RESOLVED')}
                        disabled={busy !== null}
                        aria-label="تم الحل"
                      >
                        <CheckCircle size={17} />
                      </button>
                      <button
                        className="icon-button danger"
                        title="رفض"
                        onClick={() => void update(r.id, 'DISMISSED')}
                        disabled={busy !== null}
                        aria-label="رفض البلاغ"
                      >
                        <XCircle size={17} />
                      </button>
                    </>
                  )}
                  {canArchive && (
                    <button
                      className="icon-button danger"
                      title={
                        r.attachment && !r.attachment.isCurrent
                          ? 'بلاغ على نسخة قديمة؛ راجع الملفات الحالية'
                          : 'ملف تالف: أرشفة المحتوى من البوت'
                      }
                      aria-label="أرشفة المحتوى من البوت مع إمكانية الاسترجاع"
                      disabled={
                        busy !== null ||
                        !r.contentItem.state ||
                        !r.contentItem._count ||
                        r.contentItem.state === 'ARCHIVED' ||
                        (r.attachment !== null &&
                          r.attachment !== undefined &&
                          !r.attachment.isCurrent)
                      }
                      onClick={() => void archive(r)}
                    >
                      <Archive size={17} />
                    </button>
                  )}
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
