import { ContentManager } from '../../../src/components/content-manager';
import { serverApi } from '../../../src/lib/server-api';
type Item = {
  id: string;
  titleAr: string;
  titleEn?: string;
  sectionId: string;
  bodyText?: string;
  contentCategoryId: string;
  contentCategory: { nameAr: string };
  contentType: 'TEXT' | 'LINK' | 'FILE';
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  displayOrder: number;
  section: {
    nameAr: string;
    course: { id: string; nameAr: string; semester: { id: string; academicYearId: string } };
  };
  attachments: Array<{
    id: string;
    storageProvider: 'TELEGRAM' | 'EXTERNAL_URL';
    originalFilename: string;
    externalUrl?: string;
  }>;
};
type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
};
export default async function Page() {
  const [content, categories, sections, courses, semesters, years] = await Promise.all([
    serverApi<{ items: Item[] }>('content?pageSize=100'),
    serverApi<{ items: Option[] }>('catalog/content-types?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/sections?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/courses?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/semesters?pageSize=100&active=true'),
    serverApi<{ items: Option[] }>('catalog/years?pageSize=100&active=true'),
  ]);
  return (
    <ContentManager
      items={content.items}
      categories={categories.items}
      sections={sections.items}
      courses={courses.items}
      semesters={semesters.items}
      years={years.items}
    />
  );
}
