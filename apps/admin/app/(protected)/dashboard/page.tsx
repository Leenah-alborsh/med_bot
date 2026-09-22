import { Activity, Bot, GraduationCap, UserRoundPlus } from 'lucide-react';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';
interface Stats {
  definitions: { newStudentsDays: number; recentlyActiveDays: number };
  totalUniqueStudents: number;
  newStudents: number;
  recentlyActiveStudents: number;
  studentsPerBot: Array<{ botId: string; displayName: string; count: number }>;
  studentsPerAcademicYear: Array<{ academicYearId: string; nameAr: string; count: number }>;
}
const t = {
  eyebrow: 'نظرة عامة',
  title: 'الرئيسية',
  welcome: 'مرحباً',
  total: 'إجمالي الطلاب',
  newStudents: 'طلاب جدد',
  active: 'نشطون حديثاً',
  bot: 'الطلاب حسب بوت طلاب الطب',
  years: 'الطلاب حسب السنة',
  count: 'العدد',
  noStats: 'لا توجد إحصائيات متاحة لهذا الحساب',
};
export default async function DashboardPage() {
  const admin = await getCurrentAdmin();
  const stats = hasPermission(admin, 'students.stats.read')
    ? await serverApi<Stats>('statistics/students')
    : null;
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="muted">
            {t.welcome}
            {'، '}
            {admin.displayNameAr}
          </p>
        </div>
      </header>
      {stats ? (
        <>
          <section className="metric-grid">
            <article className="metric">
              <span>
                <GraduationCap size={18} /> {t.total}
              </span>
              <strong>{stats.totalUniqueStudents}</strong>
            </article>
            <article className="metric">
              <span>
                <UserRoundPlus size={18} /> {t.newStudents}
              </span>
              <strong>{stats.newStudents}</strong>
            </article>
            <article className="metric">
              <span>
                <Activity size={18} /> {t.active}
              </span>
              <strong>{stats.recentlyActiveStudents}</strong>
            </article>
          </section>
          <section className="two-column">
            <div>
              <h2>
                <Bot size={18} /> {t.bot}
              </h2>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {stats.studentsPerBot.map((r) => (
                      <tr key={r.botId}>
                        <td>{r.displayName}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2>{t.years}</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.years}</th>
                      <th>{t.count}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.studentsPerAcademicYear.map((r) => (
                      <tr key={r.academicYearId}>
                        <td>{r.nameAr}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <h2>{t.noStats}</h2>
        </section>
      )}
    </main>
  );
}
