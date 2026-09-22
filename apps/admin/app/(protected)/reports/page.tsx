import { ReportsTable } from '../../../src/components/reports-table';
import { serverApi } from '../../../src/lib/server-api';
type Report = {
  id: string;
  status: string;
  createdAt: string;
  contentItem: { titleAr: string; section: { nameAr: string; course: { nameAr: string } } };
  attachment?: { originalFilename: string };
};
const text = {
  eyebrow: 'جودة المحتوى',
  title: 'بلاغات الملفات',
  subtitle: 'راجع مشكلات الطلاب ووثّق قرار المعالجة.',
};
export default async function Page() {
  const data = await serverApi<{ items: Report[] }>('broken-file-reports?pageSize=100');
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="muted">{text.subtitle}</p>
        </div>
      </header>
      <ReportsTable reports={data.items} />
    </main>
  );
}
