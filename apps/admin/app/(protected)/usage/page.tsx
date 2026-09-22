import { serverApi } from '../../../src/lib/server-api';
type Usage = {
  mostUsedCourses: Array<{ courseId: string; nameAr: string; count: number }>;
  mostOpened: Array<{ id: string; titleAr: string; contentType: string; count: number }>;
};
const t = {
  eyebrow:
    '\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645',
  title:
    '\u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0623\u0643\u062b\u0631 \u0627\u0633\u062a\u062e\u062f\u0627\u0645\u0627\u064b',
  courses:
    '\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0623\u0643\u062b\u0631 \u0627\u0633\u062a\u062e\u062f\u0627\u0645\u0627\u064b',
  content:
    '\u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0623\u0643\u062b\u0631 \u0641\u062a\u062d\u0627\u064b',
  empty:
    '\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0628\u0639\u062f.',
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
                      <span className="table-subtitle">{r.contentType}</span>
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
