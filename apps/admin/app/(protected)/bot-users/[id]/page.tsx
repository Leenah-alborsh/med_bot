import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentAdmin, serverApi, ServerApiError } from '../../../../src/lib/server-api';
import {
  activityDate,
  usageLabels,
  usageQuery,
  userName,
  type UserIdentity,
  type UsageFilters,
} from '../../../../src/lib/bot-users';
import { BotUsageFilters, UsagePagination } from '../../../../src/components/bot-usage-filters';

type Result = {
  student: UserIdentity;
  total: number;
  page: number;
  pageSize: number;
  actions: Array<{ action: string; count: number }>;
  recentInteractions: Array<{
    id: string;
    action: string;
    isSessionStart: boolean;
    createdAt: string;
  }>;
  content: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    contentItem: {
      titleAr: string;
      contentType: string;
      section: { nameAr: string; course: { nameAr: string } };
    };
  }>;
};

export default async function BotUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<UsageFilters>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin.roleKeys.includes('super-admin')) redirect('/dashboard');
  const { id } = await params;
  const filters = await searchParams;
  let result: Result;
  try {
    result = await serverApi<Result>(
      `statistics/bot-users/${encodeURIComponent(id)}?${usageQuery(filters)}`,
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) notFound();
    if (error instanceof ServerApiError && error.status === 400)
      return (
        <main className="page">
          <h1>تعذّر عرض النشاط</h1>
          <p role="alert">تحقق من المعرّف والتواريخ ورقم الصفحة.</p>
          <Link href="/bot-users">العودة للمستخدمين</Link>
        </main>
      );
    throw error;
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">نشاط المستخدم</p>
          <h1>{userName(result.student)}</h1>
          <p dir="ltr">
            {result.student.username ? `@${result.student.username} · ` : ''}
            {result.student.telegramUserId}
          </p>
          <p className="muted">
            أول استخدام: {activityDate(result.student.firstSeenAt)} · آخر نشاط:{' '}
            {activityDate(result.student.lastSeenAt)}
          </p>
        </div>
        <Link className="secondary-link" href="/bot-users">
          جميع المستخدمين
        </Link>
      </header>
      <BotUsageFilters filters={filters} />
      <section>
        <h2>التفاعلات ضمن الفترة</h2>
        <div className="metric-grid">
          {result.actions.map((row) => (
            <article className="metric" key={row.action}>
              <span>{usageLabels[row.action] ?? row.action}</span>
              <strong>{row.count}</strong>
            </article>
          ))}
        </div>
        {!result.actions.length && (
          <p className="empty-state">لا توجد تفاعلات مسجّلة ضمن الفترة.</p>
        )}
      </section>
      <section>
        <h2>المحتوى الذي استخدمه</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المحتوى</th>
                <th>المادة / القسم</th>
                <th>الإجراء</th>
                <th>الوقت بتوقيت فلسطين</th>
              </tr>
            </thead>
            <tbody>
              {result.content.map((row) => (
                <tr key={row.id}>
                  <td>{row.contentItem.titleAr}</td>
                  <td>
                    {row.contentItem.section.course.nameAr}
                    <span className="table-subtitle">{row.contentItem.section.nameAr}</span>
                  </td>
                  <td>{usageLabels[row.eventType] ?? row.eventType}</td>
                  <td>{activityDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.content.length && <p className="empty-state">لا توجد طلبات محتوى ضمن الفترة.</p>}
        </div>
        <UsagePagination {...result} filters={filters} />
      </section>
      <section>
        <h2>آخر 25 تفاعلًا ضمن الفترة</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>التفاعل</th>
                <th>الجلسة</th>
                <th>الوقت بتوقيت فلسطين</th>
              </tr>
            </thead>
            <tbody>
              {result.recentInteractions.map((row) => (
                <tr key={row.id}>
                  <td>{usageLabels[row.action] ?? row.action}</td>
                  <td>{row.isSessionStart ? 'بداية جلسة' : 'استمرار'}</td>
                  <td>{activityDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.recentInteractions.length && <p className="empty-state">لا توجد تفاعلات.</p>}
        </div>
      </section>
    </main>
  );
}
