import { CatalogManager } from '../../../src/components/catalog-manager';
import { allCatalogItems } from '../../../src/lib/catalog-items';
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
  hasSections?: boolean;
};
type Option = Item;
export default async function Page() {
  const [data, sections, courses, semesters, years] = await Promise.all([
    allCatalogItems<Item>('content-types'),
    allCatalogItems<Option>('sections', { active: 'true' }),
    allCatalogItems<Option>('courses', { active: 'true' }),
    allCatalogItems<Option>('semesters', { active: 'true' }),
    allCatalogItems<Option>('years', { active: 'true' }),
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
