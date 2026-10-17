import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, CalendarDays, FileText, LogIn, Users, UserCheck } from 'lucide-react';
import styles from '../../../src/components/bot-usage.module.css';
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
          <p className={`muted ${styles.intro}`}>
            الجلسة تبدأ بأول تفاعل، ثم بعد انقطاع 30 دقيقة. فتح المحادثة وحده لا يُحسب. عدّ الجلسات
            والتفاعلات يبدأ من تفعيل التتبّع؛ سجلات المحتوى السابقة متاحة.
          </p>
        </div>
      </header>
      <BotUsageFilters filters={filters} search />
      <section className={styles.metrics} aria-label="ملخص الاستخدام">
        {[
          { label: 'المستخدمون', value: result.total, icon: Users, note: 'حسب الفلاتر المحددة' },
          {
            label: 'الجلسات',
            value: result.summary.sessions,
            icon: LogIn,
            note: 'حسب الفلاتر المحددة',
          },
          {
            label: 'التفاعلات',
            value: result.summary.interactions,
            icon: Activity,
            note: 'حسب الفلاتر المحددة',
          },
          {
            label: 'طلبات المحتوى',
            value: result.summary.contentUses,
            icon: FileText,
            note: 'حسب الفلاتر المحددة',
          },
          {
            label: 'نشطون خلال 24 ساعة',
            value: result.summary.activeToday,
            icon: UserCheck,
            note: 'جميع المستخدمين',
          },
          {
            label: 'نشطون خلال 7 أيام',
            value: result.summary.activeWeek,
            icon: CalendarDays,
            note: 'جميع المستخدمين',
          },
        ].map(({ label, value, icon: Icon, note }) => (
          <article className={styles.metric} key={label}>
            <p>{label}</p>
            <span className={styles.metricIcon} aria-hidden="true">
              <Icon size={20} />
            </span>
            <strong>{value.toLocaleString('en-US')}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <div className={styles.tableHeading}>
        <h2>قائمة المستخدمين</h2>
        <p>مرتبة حسب آخر نشاط · {result.total.toLocaleString('en-US')} مستخدم</p>
      </div>
      <div className={`table-wrap ${styles.usersTable}`}>
        <table>
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>السنة</th>
              <th>أوقات النشاط</th>
              <th>نشاط البوت</th>
              <th>المحتوى المستخدم</th>
              <th>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((user) => (
              <tr key={user.id}>
                <td className={styles.userCell}>
                  <strong>{userName(user)}</strong>
                  <div className={styles.identity}>
                    {user.username && <bdi>@{user.username}</bdi>}
                    <bdi>{user.telegramUserId}</bdi>
                  </div>
                </td>
                <td data-label="السنة الدراسية">
                  {user.selectedAcademicYear?.nameAr ?? 'غير محددة'}
                </td>
                <td>
                  <div className={styles.dates}>
                    <div className={styles.dateLine}>
                      <small>آخر نشاط</small>
                      <time dateTime={user.lastSeenAt}>{activityDate(user.lastSeenAt)}</time>
                    </div>
                    <div className={styles.dateLine}>
                      <small>أول استخدام</small>
                      <time dateTime={user.firstSeenAt}>{activityDate(user.firstSeenAt)}</time>
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.counts}>
                    <div>
                      <strong>{user.sessions}</strong>
                      <small>جلسات</small>
                    </div>
                    <div>
                      <strong>{user.starts}</strong>
                      <small>
                        <bdi dir="ltr">/start</bdi>
                      </small>
                    </div>
                    <div>
                      <strong>{user.interactions}</strong>
                      <small>تفاعلات</small>
                    </div>
                  </div>
                </td>
                <td data-label="المحتوى المستخدم">
                  <div className={styles.contentUses}>
                    {user.contentUses.map((row) => (
                      <span className={styles.contentBadge} key={row.type}>
                        {usageLabels[row.type] ?? row.type} <strong>{row.count}</strong>
                      </span>
                    ))}
                    {!user.contentUses.length && '—'}
                  </div>
                </td>
                <td>
                  <Link
                    className={styles.activityLink}
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
      <p className={styles.footnote}>
        الأوقات بتوقيت فلسطين. طلب الرابط يعني إرسال الرابط للمستخدم؛ لا يؤكد فتحه في المتصفح. طلب
        الملف لا يؤكد تنزيله على الجهاز.
      </p>
    </main>
  );
}
