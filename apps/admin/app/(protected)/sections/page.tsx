import { CatalogManager } from '../../../src/components/catalog-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = { id: string; nameAr: string; nameEn: string; displayOrder: number; isActive: boolean };
export default async function Page() {
  const [data, parents] = await Promise.all([
    serverApi<{ items: Item[] }>('catalog/sections?pageSize=100'),
    serverApi<{ items: Item[] }>('catalog/courses?pageSize=100&active=true'),
  ]);
  return <CatalogManager kind="sections" items={data.items} parents={parents.items} />;
}
