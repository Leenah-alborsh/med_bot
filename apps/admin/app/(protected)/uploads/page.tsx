import { redirect } from 'next/navigation';
import { AdminFileUploader, type UploadTarget } from '../../../src/components/admin-file-uploader';
import { serverApi, ServerApiError } from '../../../src/lib/server-api';
import { getUploadConfig } from '../../../src/lib/server-upload-config';
import { directUploadBaseUrl } from '../../../src/lib/direct-upload';
import {
  emptyUploadFilters,
  uploadFilterKeys,
  matchesUploadTarget,
} from '../../../src/lib/upload-target-filters';

const queryKeys = {
  year: 'yearId',
  semester: 'semesterId',
  course: 'courseId',
  section: 'sectionId',
  category: 'contentCategoryId',
} as const;
export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsedPage = Number(params.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const filters = { ...emptyUploadFilters };
  const query = new URLSearchParams({ page: String(page), pageSize: '25' });
  for (const key of uploadFilterKeys) {
    const value = params[queryKeys[key]];
    if (typeof value === 'string' && value) {
      filters[key] = value;
      query.set(queryKeys[key], value);
    }
  }
  const search = typeof params.search === 'string' ? params.search.slice(0, 100) : '';
  if (search) query.set('search', search);
  const targets = serverApi<{
    items: UploadTarget[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>(`content/upload-targets?${query}`);
  const [rawData, options, config] = await Promise.all([
    targets,
    serverApi<{ items: UploadTarget[] }>('content/upload-target-options').catch(
      async (error: unknown) => {
        if (error instanceof ServerApiError && error.status === 404)
          return { items: (await targets).items };
        throw error;
      },
    ),
    getUploadConfig(),
  ]);
  // Keep the page usable while an older API and the new frontend coexist.
  const legacyItems =
    rawData.total === undefined
      ? rawData.items.filter((item) => matchesUploadTarget(item, filters, search))
      : null;
  const data = {
    items: legacyItems ? legacyItems.slice((page - 1) * 25, page * 25) : rawData.items,
    total: rawData.total ?? legacyItems?.length ?? 0,
    page: rawData.page ?? page,
    pageSize: rawData.pageSize ?? 25,
  };
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (page > lastPage) {
    query.set('page', String(lastPage));
    redirect(`/uploads?${query}`);
  }
  return (
    <AdminFileUploader
      key={`${query}`}
      items={data.items}
      filterItems={options.items}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
      initialFilters={filters}
      initialQuery={search}
      maxUploadBytes={config.maxUploadBytes}
      uploadBaseUrl={directUploadBaseUrl(process.env)}
    />
  );
}
