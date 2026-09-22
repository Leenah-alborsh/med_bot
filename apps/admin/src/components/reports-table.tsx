'use client';
import { CheckCircle, Eye, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '../lib/client-api';
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
    const resolutionNote =
      prompt(
        '\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u0629)',
      ) ?? undefined;
    try {
      await clientApi(`broken-file-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolutionNote }),
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : '\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0628\u0644\u0627\u063a.',
      );
    }
  }
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>\u0627\u0644\u0645\u062d\u062a\u0648\u0649</th>
              <th>\u0627\u0644\u0645\u0644\u0641</th>
              <th>\u0627\u0644\u062d\u0627\u0644\u0629</th>
              <th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th>
              <th>\u0627\u0644\u0625\u062c\u0631\u0627\u0621</th>
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
                <td>{r.attachment?.originalFilename ?? '\u2014'}</td>
                <td>
                  <span className="badge">{r.status}</span>
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString('ar')}</td>
                <td className="row-actions">
                  <button
                    className="icon-button"
                    title="\u062a\u0645\u062a \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629"
                    onClick={() => void update(r.id, 'REVIEWED')}
                  >
                    <Eye size={17} />
                  </button>
                  <button
                    className="icon-button success"
                    title="\u062a\u0645 \u0627\u0644\u062d\u0644"
                    onClick={() => void update(r.id, 'RESOLVED')}
                  >
                    <CheckCircle size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    title="\u0631\u0641\u0636"
                    onClick={() => void update(r.id, 'DISMISSED')}
                  >
                    <XCircle size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!reports.length && (
          <div className="empty-state">
            \u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u0644\u0627\u063a\u0627\u062a
            \u0645\u0644\u0641\u0627\u062a \u062d\u0627\u0644\u064a\u0627\u064b.
          </div>
        )}
      </div>
    </>
  );
}
