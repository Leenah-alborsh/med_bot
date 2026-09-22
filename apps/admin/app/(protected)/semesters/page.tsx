import { CatalogManager } from '../../../src/components/catalog-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = { id: string; nameAr: string; nameEn: string; displayOrder: number; isActive: boolean };
export default async function Page() {
  const [data, years] = await Promise.all([
    serverApi<{ items: Item[] }>('catalog/semesters?pageSize=100'),
    serverApi<{ items: Item[] }>('catalog/years?pageSize=100&active=true'),
  ]);
  return <CatalogManager kind="semesters" items={data.items} parents={years.items} />;
}
