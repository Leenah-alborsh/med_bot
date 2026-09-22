import { serverApi } from '../../../src/lib/server-api';
type Log = {
  id: string;
  actionKey: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
  actor?: { displayNameAr: string; email: string };
};
const t = {
  eyebrow:
    '\u0627\u0644\u0634\u0641\u0627\u0641\u064a\u0629 \u0648\u0627\u0644\u0631\u0642\u0627\u0628\u0629',
  title: '\u0633\u062c\u0644 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a',
  action: '\u0627\u0644\u0639\u0645\u0644\u064a\u0629',
  actor: '\u0627\u0644\u0645\u0634\u0631\u0641',
  target: '\u0627\u0644\u0639\u0646\u0635\u0631',
  date: '\u0627\u0644\u062a\u0627\u0631\u064a\u062e',
  system: '\u0627\u0644\u0646\u0638\u0627\u0645',
};
export default async function Page() {
  const data = await serverApi<{ items: Log[] }>('audit?pageSize=100');
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.action}</th>
              <th>{t.actor}</th>
              <th>{t.target}</th>
              <th>{t.date}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td>
                  <code>{row.actionKey}</code>
                </td>
                <td>
                  {row.actor?.displayNameAr ?? t.system}
                  <span className="table-subtitle">{row.actor?.email}</span>
                </td>
                <td>
                  {row.entityType}
                  <span className="table-subtitle">{row.entityId}</span>
                </td>
                <td>{new Date(row.createdAt).toLocaleString('ar')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
