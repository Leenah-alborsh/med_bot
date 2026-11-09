import { beforeEach, expect, it, vi } from 'vitest';
import { getCatalogOptions } from '../src/lib/catalog-options';
import { serverApi, ServerApiError } from '../src/lib/server-api';
vi.mock('../src/lib/server-api', () => ({
  serverApi: vi.fn(),
  ServerApiError: class extends Error {
    constructor(public status: number) {
      super();
    }
  },
}));
beforeEach(() => vi.clearAllMocks());
it('loads all catalog filter metadata in one request', async () => {
  const data = {
    years: { items: [] },
    semesters: { items: [] },
    courses: { items: [] },
    sections: { items: [] },
    'content-types': { items: [] },
  };
  vi.mocked(serverApi).mockResolvedValue(data);
  expect(await getCatalogOptions()).toBe(data);
  expect(serverApi).toHaveBeenCalledTimes(1);
  expect(serverApi).toHaveBeenCalledWith('catalog/options');
});
it('supports a rolling deployment without hiding API failures', async () => {
  vi.mocked(serverApi).mockImplementation((path) =>
    path === 'catalog/options'
      ? Promise.reject(new ServerApiError(404))
      : Promise.resolve({ items: [], total: 0, pageSize: 100 }),
  );
  expect((await getCatalogOptions()).courses.items).toEqual([]);
  expect(serverApi).toHaveBeenCalledTimes(6);
  vi.mocked(serverApi).mockRejectedValue(new ServerApiError(500));
  await expect(getCatalogOptions()).rejects.toThrow();
});
