export type UploadTarget = {
  id: string;
  titleAr: string;
  sectionId?: string;
  contentCategoryId?: string;
  contentCategory?: { nameAr: string };
  section: {
    nameAr: string;
    course: {
      id?: string;
      nameAr: string;
      semester: {
        id?: string;
        nameAr?: string;
        academicYearId?: string;
        academicYear: { nameAr: string };
      };
    };
  };
};

export const uploadFilterKeys = ['year', 'semester', 'course', 'section', 'category'] as const;
export type UploadFilterKey = (typeof uploadFilterKeys)[number];
export type UploadFilters = Record<UploadFilterKey, string>;
export const emptyUploadFilters: UploadFilters = {
  year: '',
  semester: '',
  course: '',
  section: '',
  category: '',
};

function destination(item: UploadTarget, key: UploadFilterKey) {
  const { course } = item.section;
  const { semester } = course;
  const year = semester.academicYearId ?? semester.academicYear.nameAr;
  const term = semester.id ?? `${year}/${semester.nameAr ?? ''}`;
  const courseId = course.id ?? `${term}/${course.nameAr}`;
  switch (key) {
    case 'year':
      return { id: year, name: semester.academicYear.nameAr };
    case 'semester':
      return { id: term, name: semester.nameAr ?? '' };
    case 'course':
      return { id: courseId, name: course.nameAr };
    case 'section':
      return {
        id: item.sectionId ?? `${courseId}/${item.section.nameAr}`,
        name: item.section.nameAr,
      };
    case 'category':
      return { id: item.contentCategoryId ?? '', name: item.contentCategory?.nameAr ?? '' };
  }
}

export function changeUploadFilter(filters: UploadFilters, key: UploadFilterKey, value: string) {
  const next = { ...filters, [key]: value };
  for (const child of uploadFilterKeys.slice(uploadFilterKeys.indexOf(key) + 1)) next[child] = '';
  return next;
}

export function uploadFilterOptions(
  items: UploadTarget[],
  filters: UploadFilters,
  key: UploadFilterKey,
) {
  const parents = uploadFilterKeys.slice(0, uploadFilterKeys.indexOf(key));
  const options = new Map<string, { id: string; name: string }>();
  for (const item of items) {
    if (
      !parents.every(
        (parent) => !filters[parent] || destination(item, parent).id === filters[parent],
      )
    )
      continue;
    const option = destination(item, key);
    if (option.id && option.name) options.set(option.id, option);
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي');
}

export function matchesUploadTarget(item: UploadTarget, filters: UploadFilters, query: string) {
  if (!uploadFilterKeys.every((key) => !filters[key] || destination(item, key).id === filters[key]))
    return false;
  const text = normalize(
    [item.titleAr, ...uploadFilterKeys.map((key) => destination(item, key).name)].join(' '),
  );
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
