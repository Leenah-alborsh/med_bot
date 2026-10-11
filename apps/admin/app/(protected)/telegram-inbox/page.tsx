import { TelegramInboxManager } from '../../../src/components/telegram-inbox-manager';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';
import { allCatalogItems } from '../../../src/lib/catalog-items';
import { getUploadConfig } from '../../../src/lib/server-upload-config';

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
  sectionId?: string;
  hasSections?: boolean;
};
type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
type ContentTarget = {
  id: string;
  titleAr: string;
  sectionId: string;
  contentCategoryId: string;
  state: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const admin = await getCurrentAdmin();
  const canCreate = hasPermission(admin, 'content.create');
  const canUpdate = hasPermission(admin, 'content.update');
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (search) query.set('search', search);
  const [inbox, years, semesters, courses, sections, categories, targets, uploadConfig] =
    await Promise.all([
      serverApi<PageResult<InboxFile>>(`telegram-inbox?${query}`),
      allCatalogItems<Option>('years', { active: 'true' }),
      allCatalogItems<Option>('semesters', { active: 'true' }),
      allCatalogItems<Option>('courses', { active: 'true' }),
      allCatalogItems<Option>('sections', { active: 'true' }),
      allCatalogItems<Option>('content-types', { active: 'true' }),
      canUpdate ? serverApi<{ items: ContentTarget[] }>('content/upload-targets') : { items: [] },
      getUploadConfig(),
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
      categories={categories.items}
      targets={targets.items}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canPublish={hasPermission(admin, 'content.publish')}
      classificationReady={uploadConfig.inboxClassificationAvailable === true}
    />
  );
}
