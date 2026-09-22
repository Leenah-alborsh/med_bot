import { serverApi } from '../../../src/lib/server-api';
const contentTypeLabels: Record<string, string> = { TEXT: 'نص', LINK: 'رابط', FILE: 'ملف' };
type Usage = {
  mostUsedCourses: Array<{ courseId: string; nameAr: string; count: number }>;
  mostOpened: Array<{ id: string; titleAr: string; contentType: string; count: number }>;
};
const t = {
  eyebrow: 'تحليلات الاستخدام',
  title: 'المحتوى الأكثر استخداماً',
  courses: 'المواد الأكثر استخداماً',
  content: 'المحتوى الأكثر فتحاً',
  empty: 'لا توجد بيانات استخدام بعد.',
};
export default async function Page() {
  const data = await serverApi<Usage>('content-usage');
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
        </div>
      </header>
      <section className="two-column">
        <div>
          <h2>{t.courses}</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {data.mostUsedCourses.map((r) => (
                  <tr key={r.courseId}>
                    <td>{r.nameAr}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.mostUsedCourses.length && <div className="empty-state">{t.empty}</div>}
          </div>
        </div>
        <div>
          <h2>{t.content}</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {data.mostOpened.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.titleAr}
                      <span className="table-subtitle">
                        {contentTypeLabels[r.contentType] ?? r.contentType}
                      </span>
                    </td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.mostOpened.length && <div className="empty-state">{t.empty}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
