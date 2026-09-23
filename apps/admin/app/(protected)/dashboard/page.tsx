import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  FileText,
  GraduationCap,
  UserRoundPlus,
} from 'lucide-react';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';

type Stats = {
  totalUniqueStudents: number;
  newStudents: number;
  recentlyActiveStudents: number;
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
    years && { label: 'السنوات المتاحة', value: years.total, icon: GraduationCap },
    courses && { label: 'المواد المتاحة', value: courses.total, icon: BookOpen },
    sections && { label: 'الأقسام المتاحة', value: sections.total, icon: Boxes },
    content && { label: 'عناصر المحتوى', value: content.total, icon: FileText },
  ].filter(Boolean) as Array<{ label: string; value: number; icon: typeof BookOpen }>;

  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>الرئيسية</h1>
          <p className="muted">
            مرحبًا، {admin.displayNameAr}. البيانات أدناه محدثة من Neon حسب صلاحياتك ونطاق وصولك.
          </p>
        </div>
      </header>

      {operational.length > 0 && (
        <>
          <div className="section-title">
            <Bot size={19} />
            <h2>المحتوى المتاح لك</h2>
          </div>
          <section className="metric-grid operational-grid">
            {operational.map(({ label, value, icon: Icon }) => (
              <article className="metric" key={label}>
                <span>
                  <Icon size={18} /> {label}
                </span>
                <strong>{value}</strong>
              </article>
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
            <article className="metric">
              <span>
                <GraduationCap size={18} /> إجمالي الطلاب
              </span>
              <strong>{stats.totalUniqueStudents}</strong>
            </article>
            <article className="metric">
              <span>
                <UserRoundPlus size={18} /> طلاب جدد
              </span>
              <strong>{stats.newStudents}</strong>
            </article>
            <article className="metric">
              <span>
                <Activity size={18} /> نشطون حديثًا
              </span>
              <strong>{stats.recentlyActiveStudents}</strong>
            </article>
          </section>
          <section className="two-column">
            <div>
              <h2>
                <Bot size={18} /> الطلاب حسب البوت
              </h2>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {stats.studentsPerBot.map((row) => (
                      <tr key={row.botId}>
                        <td>{row.displayName}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2>الطلاب حسب السنة</h2>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {stats.studentsPerAcademicYear.map((row) => (
                      <tr key={row.academicYearId}>
                        <td>{row.nameAr}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
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
