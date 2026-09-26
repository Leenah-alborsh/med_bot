import { CatalogManager } from '../../../src/components/catalog-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = {
  id: string;
  nameAr: string;
  nameEn: string;
  displayOrder: number;
  hasSections?: boolean;
  isActive: boolean;
  academicYearId?: string;
  semesterId?: string;
};
type SemesterOption = Item & { academicYearId: string };
export default async function Page() {
  const [data, parents, years] = await Promise.all([
    serverApi<{ items: Item[] }>('catalog/courses?pageSize=100'),
    serverApi<{ items: SemesterOption[] }>('catalog/semesters?pageSize=100&active=true'),
    serverApi<{ items: Item[] }>('catalog/years?pageSize=100&active=true'),
  ]);
  return (
    <CatalogManager
      kind="courses"
      items={data.items}
      parents={parents.items}
      years={years.items}
      semesters={parents.items}
    />
  );
}
