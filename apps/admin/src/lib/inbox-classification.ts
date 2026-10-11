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
