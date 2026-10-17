import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin, serverApi, ServerApiError } from '../../../src/lib/server-api';
import {
  activityDate,
  usageLabels,
  usageQuery,
  userName,
  type UserIdentity,
  type UsageFilters,
} from '../../../src/lib/bot-users';
import { BotUsageFilters, UsagePagination } from '../../../src/components/bot-usage-filters';

type Result = {
  total: number;
  page: number;
  pageSize: number;
  summary: {
    sessions: number;
    interactions: number;
    contentUses: number;
    activeToday: number;
    activeWeek: number;
  };
  items: Array<
    UserIdentity & {
      selectedAcademicYear: { nameAr: string } | null;
      sessions: number;
      starts: number;
      interactions: number;
      contentUses: Array<{ type: string; count: number }>;
    }
  >;
};

export default async function BotUsersPage({
  searchParams,
}: {
  searchParams: Promise<UsageFilters>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin.roleKeys.includes('super-admin')) redirect('/dashboard');
  const filters = await searchParams;
  let result: Result;
  try {
    result = await serverApi<Result>(`statistics/bot-users?${usageQuery(filters)}`);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 400)
      return (
        <main className="page">
          <h1>مستخدمو البوت</h1>
          <p role="alert">تحقق من التواريخ ورقم الصفحة. تاريخ البداية يجب أن يسبق النهاية.</p>
          <Link href="/bot-users">إعادة ضبط الفلاتر</Link>
        </main>
      );
    throw error;
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">للسوبر أدمن</p>
          <h1>مستخدمو البوت</h1>
          <p className="muted">
            الجلسة تبدأ بأول تفاعل، ثم بعد انقطاع 30 دقيقة. فتح المحادثة وحده لا يُحسب. عدّ الجلسات
            والتفاعلات يبدأ من تفعيل التتبّع؛ سجلات المحتوى السابقة متاحة.
          </p>
        </div>
      </header>
      <BotUsageFilters filters={filters} search />
      <section className="metric-grid">
        {[
          ['المستخدمون المطابقون', result.total],
          ['جلسات ضمن الفلتر', result.summary.sessions],
          ['تفاعلات ضمن الفلتر', result.summary.interactions],
          ['طلبات محتوى ضمن الفلتر', result.summary.contentUses],
          ['نشطون خلال 24 ساعة · جميع المستخدمين', result.summary.activeToday],
          ['نشطون خلال 7 أيام · جميع المستخدمين', result.summary.activeWeek],
        ].map(([label, value], index) => (
          <article className="metric" key={label} data-tone={index % 3}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>السنة</th>
              <th>أول استخدام / آخر نشاط</th>
              <th>الجلسات</th>
              <th>مرات /start</th>
              <th>التفاعلات</th>
              <th>المحتوى المستخدم</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{userName(user)}</strong>
                  <span className="table-subtitle" dir="ltr">
                    {user.username ? `@${user.username} · ` : ''}
                    {user.telegramUserId}
                  </span>
                </td>
                <td>{user.selectedAcademicYear?.nameAr ?? 'غير محددة'}</td>
                <td>
                  {activityDate(user.firstSeenAt)}
                  <span className="table-subtitle">{activityDate(user.lastSeenAt)}</span>
                </td>
                <td>{user.sessions}</td>
                <td>{user.starts}</td>
                <td>{user.interactions}</td>
                <td>
                  {user.contentUses.map((row) => (
                    <span className="table-subtitle" key={row.type}>
                      {usageLabels[row.type] ?? row.type}: {row.count}
                    </span>
                  ))}
                  {!user.contentUses.length && '—'}
                </td>
                <td>
                  <Link
                    className="secondary-link"
                    href={`/bot-users/${user.id}?${usageQuery({ from: filters.from, to: filters.to })}`}
                  >
                    عرض النشاط
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.items.length && (
          <div className="empty-state">لا يوجد مستخدمون مطابقون للفلاتر.</div>
        )}
      </div>
      <UsagePagination {...result} filters={filters} />
      <p className="muted">
        الأوقات بتوقيت فلسطين. طلب الرابط يعني إرسال الرابط للمستخدم؛ لا يؤكد فتحه في المتصفح. طلب
        الملف لا يؤكد تنزيله على الجهاز.
      </p>
    </main>
  );
}
