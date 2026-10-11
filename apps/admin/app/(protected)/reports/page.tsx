import { ReportsTable, type Report } from '../../../src/components/reports-table';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';
const text = {
  eyebrow: 'جودة المحتوى',
  title: 'بلاغات الملفات',
  subtitle: 'راجع مشكلات الطلاب ووثّق قرار المعالجة.',
};
export default async function Page() {
  const [data, admin] = await Promise.all([
    serverApi<{ items: Report[] }>('broken-file-reports?pageSize=100'),
    getCurrentAdmin(),
  ]);
  const canManage = hasPermission(admin, 'broken-file-reports.manage');
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.subtitle}</p>
        </div>
      </header>
      <ReportsTable
        reports={data.items}
        canManage={canManage}
        canArchive={canManage && hasPermission(admin, 'content.publish')}
        canReadContent={hasPermission(admin, 'content.read')}
      />
    </main>
  );
}
