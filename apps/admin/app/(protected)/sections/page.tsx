import { CatalogManager } from '../../../src/components/catalog-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = {
  id: string;
  nameAr: string;
  nameEn: string;
  displayOrder: number;
  isActive: boolean;
  courseId?: string;
  academicYearId?: string;
  semesterId?: string;
};
type SemesterOption = Item & { academicYearId: string };
export default async function Page() {
  const [data, courses, years, semesters] = await Promise.all([
    serverApi<{ items: Item[] }>('catalog/sections?pageSize=100'),
    serverApi<{ items: Item[] }>('catalog/courses?pageSize=100&active=true'),
    serverApi<{ items: Item[] }>('catalog/years?pageSize=100&active=true'),
    serverApi<{ items: SemesterOption[] }>('catalog/semesters?pageSize=100&active=true'),
  ]);
  return (
    <CatalogManager
      kind="sections"
      items={data.items}
      parents={courses.items}
      years={years.items}
      semesters={semesters.items}
    />
  );
}
