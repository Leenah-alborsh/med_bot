import { describe, expect, it } from 'vitest';
import {
  changeUploadFilter,
  emptyUploadFilters,
  matchesUploadTarget,
  uploadFilterOptions,
  type UploadTarget,
} from '../src/lib/upload-target-filters';

const target = (id: string, year: string, course: string): UploadTarget => ({
  id,
  titleAr: 'شرح الأسئلة',
  sectionId: `section-${id}`,
  contentCategoryId: `category-${id}`,
  contentCategory: { nameAr: 'محاضرات' },
  section: {
    nameAr: 'أبو ديس',
    course: {
      id: course,
      nameAr: 'كيمياء عامة',
      semester: {
        id: `semester-${year}`,
        nameAr: 'الفصل الأول',
        academicYearId: year,
        academicYear: { nameAr: year },
      },
    },
  },
});
const items: [UploadTarget, UploadTarget] = [
  target('a', 'first', 'chemistry-a'),
  target('b', 'second', 'chemistry-b'),
];

describe('upload destination filters', () => {
  it('matches Arabic spelling and diacritics across the entire destination', () => {
    expect(matchesUploadTarget(items[0], emptyUploadFilters, 'اَسئلة ابو ديس')).toBe(true);
    expect(matchesUploadTarget(items[0], emptyUploadFilters, 'محاضرات كيمياء')).toBe(true);
    expect(matchesUploadTarget(items[0], emptyUploadFilters, 'غير موجود')).toBe(false);
    expect(matchesUploadTarget(items[0], emptyUploadFilters, '   ')).toBe(true);
  });
  it('keeps identically named destinations distinct and scopes child options', () => {
    expect(uploadFilterOptions(items, emptyUploadFilters, 'semester')).toHaveLength(2);
    const filters = { ...emptyUploadFilters, year: 'first' };
    expect(uploadFilterOptions(items, filters, 'course').map((option) => option.id)).toEqual([
      'chemistry-a',
    ]);
    expect(matchesUploadTarget(items[1], filters, '')).toBe(false);
  });
  it('clears descendants when a parent changes without clearing ancestors', () => {
    const filters = {
      year: 'first',
      semester: 'term',
      course: 'course',
      section: 'section',
      category: 'category',
    };
    expect(changeUploadFilter(filters, 'course', 'new')).toEqual({
      ...filters,
      course: 'new',
      section: '',
      category: '',
    });
    expect(filters.section).toBe('section');
  });
  it('supports older upload responses without filter metadata', () => {
    const old: UploadTarget = {
      id: 'old',
      titleAr: 'Summary',
      section: {
        nameAr: 'Notes',
        course: { nameAr: 'Chemistry', semester: { academicYear: { nameAr: 'Third' } } },
      },
    };
    expect(uploadFilterOptions([old], emptyUploadFilters, 'course')).toHaveLength(1);
    expect(matchesUploadTarget(old, emptyUploadFilters, 'CHEMISTRY summary')).toBe(true);
  });
});
