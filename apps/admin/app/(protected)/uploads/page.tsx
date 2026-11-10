import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminFileUploader, type UploadTarget } from '../../../src/components/admin-file-uploader';
import { serverApi, ServerApiError } from '../../../src/lib/server-api';
import { getUploadConfig } from '../../../src/lib/server-upload-config';
import { directUploadBaseUrl } from '../../../src/lib/direct-upload';
import {
  emptyUploadFilters,
  uploadFilterKeys,
  matchesUploadTarget,
} from '../../../src/lib/upload-target-filters';

class UploadPageLoadError extends Error {
  constructor(
    public readonly stage: string,
    public readonly status: number | null,
  ) {
    super('Upload page dependency failed');
  }
}
async function loadDependency<T>(stage: string, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    // Preserve Next authentication and navigation signals.
    if (error instanceof ServerApiError) throw new UploadPageLoadError(stage, error.status);
    if (
      error instanceof TypeError ||
      (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
    ) {
      throw new UploadPageLoadError(stage, null);
    }
    throw error;
  }
}

const queryKeys = {
  year: 'yearId',
  semester: 'semesterId',
  course: 'courseId',
  section: 'sectionId',
  category: 'contentCategoryId',
} as const;
async function loadUploadsPage({
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
  const targets = loadDependency('قائمة الملفات', () =>
    serverApi<{
      items: UploadTarget[];
      total?: number;
      page?: number;
      pageSize?: number;
    }>(`content/upload-targets?${query}`),
  );
  const [rawData, options, config] = await Promise.all([
    targets,
    loadDependency('فلاتر الملفات', () =>
      serverApi<{ items: UploadTarget[] }>('content/upload-target-options').catch(
        async (error: unknown) => {
          if (error instanceof ServerApiError && error.status === 404)
            return { items: (await targets).items };
          throw error;
        },
      ),
    ),
    loadDependency('إعدادات الرفع', getUploadConfig),
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

export default async function UploadsPage(props: Parameters<typeof loadUploadsPage>[0]) {
  try {
    return await loadUploadsPage(props);
  } catch (error) {
    if (!(error instanceof UploadPageLoadError)) throw error;
    console.error('[uploads] API dependency failed', { stage: error.stage, status: error.status });
    const message =
      error.status === 403
        ? 'تعذر تحميل بيانات الرفع بصلاحيات حسابك. يرجى إبلاغ مسؤول المنصة إذا كانت لديك صلاحية رفع الملفات.'
        : error.status === 404
          ? 'خدمة رفع الملفات غير متاحة حاليًا. أعد المحاولة بعد قليل، أو تواصل مع مسؤول المنصة.'
          : error.status === 400
            ? 'إحدى قيم البحث أو الفلاتر غير صالحة. افتح الصفحة من جديد دون فلاتر.'
            : 'تعذر الاتصال بخدمة الملفات أو تحميل بياناتها. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول المنصة.';
    return (
      <main className="page">
        <header className="page-heading">
          <h1>رفع الملفات</h1>
        </header>
        <section role="alert">
          <h2>تعذر تحميل صفحة الرفع</h2>
          <p>{message}</p>
          <p>
            الطلب المتعذر: {error.stage}
            {error.status !== null ? ` — HTTP ${error.status}` : ''}
          </p>
          <p>لم يتم تحميل الملفات، ولا تعني هذه الرسالة أن قائمة الملفات فارغة.</p>
          <Link href="/uploads">إعادة فتح صفحة الرفع دون فلاتر</Link>
          {' · '}
          <Link href="/dashboard">العودة للرئيسية</Link>
        </section>
      </main>
    );
  }
}
