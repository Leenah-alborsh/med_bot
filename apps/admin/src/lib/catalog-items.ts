import { serverApi } from './server-api';

type CatalogPage<T> = { items: T[]; total: number; page: number; pageSize: number };

export async function allCatalogItems<T>(resource: string, filters: Record<string, string> = {}) {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const query = new URLSearchParams({ ...filters, page: String(page), pageSize: '100' });
    const result = await serverApi<CatalogPage<T>>(`catalog/${resource}?${query}`);
    items.push(...result.items);
    if (!result.items.length || page * result.pageSize >= result.total) return { items };
    page += 1;
  }
}
