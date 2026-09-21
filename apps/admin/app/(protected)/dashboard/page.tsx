import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';
interface Stats {
  definitions: { newStudentsDays: number; recentlyActiveDays: number };
  totalUniqueStudents: number;
  newStudents: number;
  recentlyActiveStudents: number;
  studentsPerBot: Array<{ botId: string; displayName: string; count: number }>;
  studentsPerAcademicYear: Array<{ academicYearId: string; nameAr: string; count: number }>;
}
export default async function DashboardPage() {
  const admin = await getCurrentAdmin();
  const stats = hasPermission(admin, 'students.stats.read')
    ? await serverApi<Stats>('statistics/students')
    : null;
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>لوحة المعلومات</h1>
        </div>
        <p className="muted">مرحباً، {admin.displayNameAr}</p>
      </div>
      {stats ? (
        <>
          <section className="metric-grid" aria-label="إحصاءات الطلاب">
            <article className="metric">
              <span>إجمالي الطلاب</span>
              <strong>{stats.totalUniqueStudents}</strong>
            </article>
            <article className="metric">
              <span>طلاب جدد خلال {stats.definitions.newStudentsDays} يوماً</span>
              <strong>{stats.newStudents}</strong>
            </article>
            <article className="metric">
              <span>نشطون خلال {stats.definitions.recentlyActiveDays} أيام</span>
              <strong>{stats.recentlyActiveStudents}</strong>
            </article>
          </section>
          <section className="two-column">
            <div>
              <h2>الطلاب حسب البوت</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>البوت</th>
                      <th>العدد</th>
                    </tr>
                  </thead>
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
                  <thead>
                    <tr>
                      <th>السنة</th>
                      <th>العدد</th>
                    </tr>
                  </thead>
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
          <section>
            <h2>تحليلات قادمة</h2>
            <div className="placeholder-grid">
              <div>المقررات الأكثر استخداماً ستظهر بعد تفعيل تتبع المحتوى.</div>
              <div>الملفات الأكثر استخداماً ستظهر بعد تفعيل تتبع المحتوى.</div>
              <div>تقارير الملفات المعطلة ستتاح عند تنفيذ مسار التقارير.</div>
            </div>
          </section>
        </>
      ) : (
        <section className="empty">
          <h2>لا توجد إحصاءات متاحة لهذا الحساب</h2>
          <p className="muted">تظهر الإحصاءات للمشرف العام فقط.</p>
        </section>
      )}
    </main>
  );
}
