import { clientApi } from './client-api';

export type InboxOption = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
  hasSections?: boolean;
};

export function inboxCategories(
  categories: InboxOption[],
  sections: InboxOption[],
  courseId: string,
  sectionId: string,
  hasSections: boolean,
) {
  if (!courseId || (hasSections && !sectionId)) return [];
  const sectionIds = new Set(
    sections
      .filter((item) => item.courseId === courseId && (!hasSections || item.id === sectionId))
      .map((item) => item.id),
  );
  return categories.filter((item) => item.sectionId && sectionIds.has(item.sectionId));
}

export type InboxTarget = {
  id: string;
  titleAr: string;
  contentCategoryId: string;
  state: string;
};

export async function inboxTargets(contentCategoryId: string, signal: AbortSignal) {
  const targets = new Map<string, InboxTarget>();
  const query = new URLSearchParams({ contentCategoryId, pageSize: '100' });

  for (let page = 1; ; page += 1) {
    query.set('page', String(page));
    const result = await clientApi<{ items: InboxTarget[]; pageSize?: number; total?: number }>(
      `content/upload-targets?${query}`,
      { signal },
    );
    for (const item of result.items) {
      if (item.contentCategoryId === contentCategoryId && item.state !== 'ARCHIVED') {
        targets.set(item.id, item);
      }
    }
    if (
      !result.items.length ||
      result.total === undefined ||
      page * (result.pageSize ?? 100) >= result.total
    ) {
      return [...targets.values()];
    }
  }
}
