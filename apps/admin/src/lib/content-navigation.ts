export function newDraftUrl(item: { sectionId: string; titleAr: string }) {
  const query = new URLSearchParams({
    page: '1',
    state: 'DRAFT',
    sectionId: item.sectionId,
    search: item.titleAr.slice(0, 100),
  });
  return `/content?${query}`;
}
