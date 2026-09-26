import { describe, expect, it } from 'vitest';
import { courseInputSchema } from '../src/catalog/catalog.schemas.js';

const baseCourse = {
  semesterId: '11111111-1111-4111-8111-111111111111',
  nameAr: 'مادة',
  nameEn: 'Course',
  displayOrder: 0,
};

describe('course section flow validation', () => {
  it('defaults existing course payloads to using sections', () => {
    expect(courseInputSchema.parse(baseCourse).hasSections).toBe(true);
  });

  it('accepts courses that skip the section step', () => {
    expect(courseInputSchema.parse({ ...baseCourse, hasSections: false }).hasSections).toBe(false);
  });
});
