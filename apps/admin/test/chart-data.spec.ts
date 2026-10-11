import { describe, expect, it } from 'vitest';
import { chartSegments } from '../src/lib/chart-data';

describe('dashboard chart data', () => {
  it('normalizes bars independently from distribution shares', () => {
    const result = chartSegments([
      { id: '1', label: 'First', value: 30 },
      { id: '2', label: 'Second', value: 10 },
    ]);
    expect(result.total).toBe(40);
    expect(result.segments[0]?.width).toBe(100);
    expect(result.segments[1]?.width).toBeCloseTo(100 / 3);
    expect(result.segments.map((item) => item.share)).toEqual([75, 25]);
    expect(result.segments[1]?.end).toBe(100);
  });
  it('handles missing, zero and invalid values without invalid CSS', () => {
    expect(chartSegments([]).total).toBe(0);
    const result = chartSegments([
      { id: '1', label: 'First', value: -1 },
      { id: '2', label: 'Second', value: NaN },
    ]);
    expect(result.total).toBe(0);
    expect(result.gradient).toBe('#e7eceb');
    expect(result.segments.every((item) => item.width === 0 && item.share === 0)).toBe(true);
  });
});
