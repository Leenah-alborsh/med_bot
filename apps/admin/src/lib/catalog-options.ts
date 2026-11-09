import { serverApi, ServerApiError } from './server-api';
export type CatalogOption = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
  hasSections?: boolean;
  courseHasSections?: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
};
const resources = ['years', 'semesters', 'courses', 'sections', 'content-types'] as const;
export type CatalogOptions = Record<(typeof resources)[number], { items: CatalogOption[] }>;
export async function getCatalogOptions(): Promise<CatalogOptions> {
  try {
    return await serverApi<CatalogOptions>('catalog/options');
  } catch (error) {
    if (!(error instanceof ServerApiError) || error.status !== 404) throw error;
    // Allow the frontend and API to roll out independently.
    const entries = await Promise.all(
      resources.map(async (resource) => {
        const items: CatalogOption[] = [];
        for (let page = 1; ; page++) {
          const result = await serverApi<{
            items: CatalogOption[];
            total: number;
            pageSize: number;
          }>(`catalog/${resource}?page=${page}&pageSize=100`);
          items.push(...result.items);
          if (!result.items.length || page * result.pageSize >= result.total)
            return [resource, { items }] as const;
        }
      }),
    );
    return Object.fromEntries(entries) as CatalogOptions;
  }
}
