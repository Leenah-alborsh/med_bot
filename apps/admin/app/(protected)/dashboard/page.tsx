import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  FileText,
  GraduationCap,
  UserRoundPlus,
  ArrowUpLeft,
  UploadCloud,
  Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';
import { DistributionChart } from '../../../src/components/distribution-chart';

type Stats = {
  totalUniqueStudents: number;
  newStudents: number;
  recentlyActiveStudents: number;
  definitions?: { newStudentsDays: number; recentlyActiveDays: number };
  studentsPerBot: Array<{ botId: string; displayName: string; count: number }>;
  studentsPerAcademicYear: Array<{ academicYearId: string; nameAr: string; count: number }>;
};
type PageResult = { total: number };

export default async function DashboardPage() {
  const admin = await getCurrentAdmin();
  const canCatalog = hasPermission(admin, 'catalog.read');
  const canContent = hasPermission(admin, 'content.read');
  const [stats, years, courses, sections, content] = await Promise.all([
    hasPermission(admin, 'students.stats.read') ? serverApi<Stats>('statistics/students') : null,
    canCatalog ? serverApi<PageResult>('catalog/years?pageSize=1') : null,
    canCatalog ? serverApi<PageResult>('catalog/courses?pageSize=1') : null,
    canCatalog ? serverApi<PageResult>('catalog/sections?pageSize=1') : null,
    canContent ? serverApi<PageResult>('content?pageSize=1') : null,
  ]);

  const operational = [
    years && { label: 'السنوات المتاحة', value: years.total, icon: GraduationCap, href: '/years' },
    courses && { label: 'المواد المتاحة', value: courses.total, icon: BookOpen, href: '/courses' },
    sections && { label: 'الأقسام المتاحة', value: sections.total, icon: Boxes, href: '/sections' },
    content && { label: 'عناصر المحتوى', value: content.total, icon: FileText, href: '/content' },
  ].filter(Boolean) as Array<{ label: string; value: number; icon: typeof BookOpen; href: string }>;

  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>مرحبًا، {admin.displayNameAr}</h1>
          <p className="muted">المكتبة التعليمية ونشاط الطلاب</p>
        </div>
        <div className="dashboard-quick-actions">
          {hasPermission(admin, 'content.update') && (
            <Link className="primary" href="/uploads">
              <UploadCloud size={17} />
              رفع ملف
            </Link>
          )}
          {canContent && hasPermission(admin, 'content.create') && (
            <Link className="secondary-action" href="/telegram-inbox">
              <Inbox size={17} />
              الملفات الواردة
            </Link>
          )}
        </div>
      </header>

      {operational.length > 0 && (
        <>
          <div className="section-title">
            <Bot size={19} />
            <h2>المحتوى المتاح لك</h2>
          </div>
          <section className="metric-grid operational-grid">
            {operational.map(({ label, value, icon: Icon, href }, index) => (
              <Link className="metric metric-link" key={label} href={href} data-tone={index}>
                <span>
                  <Icon size={18} /> {label}
                </span>
                <strong>{value}</strong>
                <ArrowUpLeft className="metric-arrow" size={17} />
              </Link>
            ))}
          </section>
        </>
      )}

      {stats ? (
        <>
          <div className="section-title">
            <Activity size={19} />
            <h2>نشاط الطلاب</h2>
          </div>
          <section className="metric-grid">
            <article className="metric" data-tone="0">
              <span>
                <GraduationCap size={18} /> إجمالي الطلاب
              </span>
              <strong>{stats.totalUniqueStudents}</strong>
            </article>
            <article className="metric" data-tone="1">
              <span>
                <UserRoundPlus size={18} /> طلاب جدد · {stats.definitions?.newStudentsDays ?? 30}{' '}
                يومًا
              </span>
              <strong>{stats.newStudents}</strong>
            </article>
            <article className="metric" data-tone="2">
              <span>
                <Activity size={18} /> نشطون · {stats.definitions?.recentlyActiveDays ?? 7} أيام
              </span>
              <strong>{stats.recentlyActiveStudents}</strong>
            </article>
          </section>
          <div className="dashboard-charts">
            <DistributionChart
              title="الطلاب حسب السنة الدراسية"
              items={stats.studentsPerAcademicYear.map((row) => ({
                id: row.academicYearId,
                label: row.nameAr,
                value: row.count,
              }))}
            />
            <DistributionChart
              title="الطلاب حسب البوت"
              unit="اشتراك"
              items={stats.studentsPerBot.map((row) => ({
                id: row.botId,
                label: row.displayName,
                value: row.count,
              }))}
            />
          </div>
        </>
      ) : (
        <p className="permission-note">
          إحصاءات الطلاب غير ظاهرة لأن دورك لا يتضمن صلاحية قراءة الإحصائيات. يمكنك إدارة المحتوى
          المتاح لك من القوائم.
        </p>
      )}
    </main>
  );
}
