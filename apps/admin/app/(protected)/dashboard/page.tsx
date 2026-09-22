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
  eyebrow: '\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629',
  title: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
  welcome: '\u0645\u0631\u062d\u0628\u0627\u064b',
  total: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0627\u0628',
  newStudents: '\u0637\u0644\u0627\u0628 \u062c\u062f\u062f',
  active: '\u0646\u0634\u0637\u0648\u0646 \u062d\u062f\u064a\u062b\u0627\u064b',
  bot: '\u0627\u0644\u0637\u0644\u0627\u0628 \u062d\u0633\u0628 \u0627\u0644\u0628\u0648\u062a',
  years: '\u0627\u0644\u0637\u0644\u0627\u0628 \u062d\u0633\u0628 \u0627\u0644\u0633\u0646\u0629',
  count: '\u0627\u0644\u0639\u062f\u062f',
  noStats:
    '\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u062d\u0633\u0627\u0628',
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
            {'\u060c '}
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
