import {
  ContentManager,
  type UnifiedContentItem,
  type ContentFilters,
} from '../../../src/components/content-manager';
import { serverApi } from '../../../src/lib/server-api';
import { redirect } from 'next/navigation';
type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
};
type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  inboxAvailable?: boolean;
};

async function catalogOptions(resource: string) {
  const items: Option[] = [];
  let page = 1;
  while (true) {
    const result = await serverApi<PageResult<Option>>(
      `catalog/${resource}?page=${page}&pageSize=100`,
    );
    items.push(...result.items);
    if (page * result.pageSize >= result.total || !result.items.length) return { items };
    page += 1;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPage = Number(params.page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const filters: ContentFilters = {};
  const query = new URLSearchParams({ page: String(page), pageSize: '25' });
  for (const key of [
    'yearId',
    'semesterId',
    'courseId',
    'sectionId',
    'contentCategoryId',
    'type',
    'state',
    'search',
  ] as const) {
    const value = params[key];
    if (typeof value === 'string' && value.trim()) {
      filters[key] = value.trim();
      query.set(key, value.trim());
    }
  }
  const [content, categories, sections, courses, semesters, years] = await Promise.all([
    serverApi<PageResult<UnifiedContentItem>>(`unified-content?${query}`),
    catalogOptions('content-types'),
    catalogOptions('sections'),
    catalogOptions('courses'),
    catalogOptions('semesters'),
    catalogOptions('years'),
  ]);
  const lastPage = Math.max(1, Math.ceil(content.total / content.pageSize));
  if (page > lastPage) {
    query.set('page', String(lastPage));
    redirect(`/content?${query}`);
  }
  return (
    <ContentManager
      items={content.items}
      total={content.total}
      page={content.page}
      pageSize={content.pageSize}
      filters={filters}
      inboxAvailable={content.inboxAvailable ?? true}
      categories={categories.items}
      sections={sections.items}
      courses={courses.items}
      semesters={semesters.items}
      years={years.items}
    />
  );
}
