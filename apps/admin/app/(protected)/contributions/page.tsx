import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin, serverApi } from '../../../src/lib/server-api';
import { contributionLabels } from '../../../src/lib/contribution-labels';

type Report = {
  month: string;
  totalUploads: number;
  unattributedUploads: number;
  items: Array<{
    id: string;
    displayNameAr: string;
    email: string;
    uploads: number;
    percentage: number;
    totalActions: number;
    lastActivity: string | null;
    actions: Array<{ actionKey: string; count: number }>;
  }>;
  details: null | {
    page: number;
    pageSize: number;
    totalFiles: number;
    files: Array<{
      id: string;
      originalFilename: string;
      contentItemId: string;
      createdAt: string;
      contentItem: { titleAr: string; state: string };
    }>;
    events: Array<{
      id: string;
      actionKey: string;
      entityType: string;
      entityId: string | null;
      createdAt: string;
    }>;
  };
};
const date = (value: string) => new Date(value).toLocaleString('ar', { timeZone: 'Asia/Hebron' });
const stateLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; adminId?: string; page?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin.roleKeys.includes('super-admin')) redirect('/dashboard');
  const search = await searchParams;
  const query = new URLSearchParams();
  if (search.month) query.set('month', search.month);
  if (search.adminId) query.set('adminId', search.adminId);
  if (search.page) query.set('page', search.page);
  const data = await serverApi<Report>(`audit/contributions?${query}`);
  const selected = data.items.find((item) => item.id === search.adminId);
  const detailUrl = (id: string, page = 1) =>
    `/contributions?${new URLSearchParams({ month: data.month, adminId: id, page: String(page) })}`;
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">متابعة الفريق</p>
          <h1>مساهمات المشرفين</h1>
        </div>
      </header>
      <form method="get" className="inline-upload">
        <label>
          الشهر <input type="month" name="month" defaultValue={data.month} required />
        </label>
        <button type="submit">عرض الشهر</button>
      </form>
      <p>
        نسبة المساهمة = عدد ملفات تليجرام المنسوبة للمشرف ÷ مجموع ملفات الفريق خلال الشهر. يُحسب
        الشهر بتوقيت فلسطين. تشمل الملفات المصنّفة من الوارد والمنشورة والمسودات، ولا تُحسب الروابط
        الخارجية.
      </p>
      <p>
        إجمالي الملفات المنسوبة للفريق: <strong>{data.totalUploads}</strong>. هذه النسبة تقيس عدد
        الملفات، ولا تقيس جودة العمل أو ساعات الدوام. يُعرض النشاط المسجّل منفصلًا، دون احتساب تسجيل
        الدخول.
      </p>
      {data.unattributedUploads > 0 && (
        <p role="status">
          هناك {data.unattributedUploads} ملفًا دون اسم رافع محفوظ؛ لا تدخل في نسب الفريق. الملفات
          المحذوفة نهائيًا لا تدخل في عدد الملفات الحالي، وتبقى العمليات المسجّلة في سجل النشاط.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>المشرف</th>
              <th>الملفات</th>
              <th>نسبة المساهمة</th>
              <th>العمليات</th>
              <th>آخر نشاط في الشهر</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.displayNameAr}
                  <span className="table-subtitle">{item.email}</span>
                </td>
                <td>{item.uploads}</td>
                <td>
                  <progress
                    value={item.percentage}
                    max={100}
                    aria-label={`نسبة مساهمة ${item.displayNameAr}`}
                  />{' '}
                  {item.percentage}%
                </td>
                <td>{item.totalActions}</td>
                <td>{item.lastActivity ? date(item.lastActivity) : 'لا يوجد نشاط مسجّل'}</td>
                <td>
                  <Link href={detailUrl(item.id)}>عرض الملفات والنشاط</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && <p>لا يوجد مشرفون.</p>}
      {selected && data.details && (
        <section aria-label="تفاصيل مساهمة المشرف">
          <h2>{selected.displayNameAr} — تفاصيل الشهر</h2>
          <ul>
            {selected.actions.map((action) => (
              <li key={action.actionKey}>
                {contributionLabels[action.actionKey] ?? action.actionKey}: {action.count}
              </li>
            ))}
          </ul>
          <h3>الملفات المرفوعة ({data.details.totalFiles})</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الملف</th>
                  <th>المحتوى</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>فتح</th>
                </tr>
              </thead>
              <tbody>
                {data.details.files.map((file) => (
                  <tr key={file.id}>
                    <td>{file.originalFilename}</td>
                    <td>{file.contentItem.titleAr}</td>
                    <td>{stateLabels[file.contentItem.state]}</td>
                    <td>{date(file.createdAt)}</td>
                    <td>
                      <a
                        href={`/api/backend/content/${file.contentItemId}/attachments/${file.id}/open`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        فتح الملف
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.details.totalFiles && <p>لا توجد ملفات منسوبة لهذا المشرف في هذا الشهر.</p>}
          <nav aria-label="صفحات ملفات المشرف">
            {data.details.page > 1 && (
              <Link href={detailUrl(selected.id, data.details.page - 1)}>السابق</Link>
            )}{' '}
            صفحة {data.details.page}{' '}
            {data.details.page * data.details.pageSize < data.details.totalFiles && (
              <Link href={detailUrl(selected.id, data.details.page + 1)}>التالي</Link>
            )}
          </nav>
          <h3>آخر 50 عملية في الشهر</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>العملية</th>
                  <th>العنصر</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {data.details.events.map((event) => (
                  <tr key={event.id}>
                    <td>{contributionLabels[event.actionKey] ?? event.actionKey}</td>
                    <td>{event.entityId ?? event.entityType}</td>
                    <td>{date(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
