import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allCatalogItems } from '../src/lib/catalog-items';
import { serverApi } from '../src/lib/server-api';

vi.mock('../src/lib/server-api', () => ({ serverApi: vi.fn() }));
const api = vi.mocked(serverApi);
beforeEach(() => api.mockReset());

describe('complete catalog loading', () => {
  it('includes saved content types beyond the first 100 rows', async () => {
    const records = Array.from({ length: 158 }, (_, index) => ({ id: String(index + 1) }));
    api.mockResolvedValueOnce({ items: records.slice(0, 100), total: 158, page: 1, pageSize: 100 });
    api.mockResolvedValueOnce({ items: records.slice(100), total: 158, page: 2, pageSize: 100 });
    const result = await allCatalogItems('content-types');
    expect(result.items).toEqual(records);
    expect(result.items).toContainEqual({ id: '130' });
    expect(api).toHaveBeenCalledTimes(2);
    expect(api).toHaveBeenLastCalledWith('catalog/content-types?page=2&pageSize=100');
  });
  it('keeps active course and section filters on later pages', async () => {
    api.mockResolvedValueOnce({ items: [{ id: 'a' }], total: 101, page: 1, pageSize: 100 });
    api.mockResolvedValueOnce({ items: [{ id: 'b' }], total: 101, page: 2, pageSize: 100 });
    expect((await allCatalogItems('courses', { active: 'true' })).items).toHaveLength(2);
    expect(api).toHaveBeenLastCalledWith('catalog/courses?active=true&page=2&pageSize=100');
  });
  it('stops on an empty page if the catalog changes while loading', async () => {
    api.mockResolvedValue({ items: [], total: 101, page: 1, pageSize: 100 });
    expect((await allCatalogItems('sections')).items).toEqual([]);
    expect(api).toHaveBeenCalledTimes(1);
  });
});
