import { TelegramInboxManager } from '../../../src/components/telegram-inbox-manager';
import { serverApi } from '../../../src/lib/server-api';

type InboxFile = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: string;
  mediaType: string;
  receivedAt: string;
};
type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  hasSections?: boolean;
};
type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) query.set('search', search);
  const [inbox, years, semesters, courses, sections] = await Promise.all([
    serverApi<PageResult<InboxFile>>(`telegram-inbox?${query}`),
    serverApi<PageResult<Option>>('catalog/years?pageSize=100&active=true'),
    serverApi<PageResult<Option>>('catalog/semesters?pageSize=100&active=true'),
    serverApi<PageResult<Option>>('catalog/courses?pageSize=100&active=true'),
    serverApi<PageResult<Option>>('catalog/sections?pageSize=100&active=true'),
  ]);
  return (
    <TelegramInboxManager
      items={inbox.items}
      total={inbox.total}
      page={inbox.page}
      pageSize={inbox.pageSize}
      search={search}
      years={years.items}
      semesters={semesters.items}
      courses={courses.items}
      sections={sections.items}
    />
  );
}
