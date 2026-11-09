import { getCatalogOptions } from '../../../src/lib/catalog-options';
import { directUploadBaseUrl } from '../../../src/lib/direct-upload';
import {
  ContentManager,
  type UnifiedContentItem,
  type ContentFilters,
} from '../../../src/components/content-manager';
import { serverApi } from '../../../src/lib/server-api';
import { getUploadConfig } from '../../../src/lib/server-upload-config';
import { redirect } from 'next/navigation';
type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  inboxAvailable?: boolean;
};

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
  const [content, options, uploadConfig] = await Promise.all([
    serverApi<PageResult<UnifiedContentItem>>(`unified-content?${query}`),
    getCatalogOptions(),
    getUploadConfig(),
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
      maxUploadBytes={uploadConfig.maxUploadBytes}
      uploadBaseUrl={directUploadBaseUrl(process.env)}
      categories={options['content-types'].items}
      sections={options.sections.items}
      courses={options.courses.items}
      semesters={options.semesters.items}
      years={options.years.items}
    />
  );
}
