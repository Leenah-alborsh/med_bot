import { CatalogManager } from '../../../src/components/catalog-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = {
  id: string;
  nameAr: string;
  nameEn: string;
  displayOrder: number;
  isActive: boolean;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
};
type Option = Item;
export default async function Page() {
  const [data, sections, courses, semesters, years] = await Promise.all([
    serverApi<{ items: Item[] }>('catalog/content-types?pageSize=100'),
    serverApi<{ items: Option[] }>('catalog/sections?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/courses?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/semesters?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/years?pageSize=100&active=true'),
  ]);
  return (
    <CatalogManager
      kind="content-types"
      items={data.items}
      parents={sections.items}
      years={years.items}
      semesters={semesters.items}
      courses={courses.items}
      sections={sections.items}
    />
  );
}
