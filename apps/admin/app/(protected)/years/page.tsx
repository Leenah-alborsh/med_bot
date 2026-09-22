import { CatalogManager } from '../../../src/components/catalog-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = { id: string; nameAr: string; nameEn: string; displayOrder: number; isActive: boolean };
export default async function Page() {
  const data = await serverApi<{ items: Item[] }>('catalog/years?pageSize=100');
  return <CatalogManager kind="years" items={data.items} />;
}
