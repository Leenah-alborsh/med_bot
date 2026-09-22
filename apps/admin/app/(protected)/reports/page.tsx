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
  eyebrow: '\u062c\u0648\u062f\u0629 \u0627\u0644\u0645\u062d\u062a\u0648\u0649',
  title: '\u0628\u0644\u0627\u063a\u0627\u062a \u0627\u0644\u0645\u0644\u0641\u0627\u062a',
  subtitle:
    '\u0631\u0627\u062c\u0639 \u0645\u0634\u0643\u0644\u0627\u062a \u0627\u0644\u0637\u0644\u0627\u0628 \u0648\u0648\u062b\u0651\u0642 \u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629.',
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
