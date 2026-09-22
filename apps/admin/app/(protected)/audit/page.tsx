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
  eyebrow: 'الشفافية والرقابة',
  title: 'سجل العمليات',
  action: 'العملية',
  actor: 'المشرف',
  target: 'العنصر',
  date: 'التاريخ',
  system: 'النظام',
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
