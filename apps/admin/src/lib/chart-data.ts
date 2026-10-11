export const chartColors = ['#138579', '#3c70ba', '#cc8b21', '#bd557b', '#775cac', '#568a41'];

export type ChartItem = { id: string; label: string; value: number };

export function chartSegments(items: ChartItem[]) {
  const values = items.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0,
  }));
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(0, ...values.map((item) => item.value));
  let offset = 0;
  const segments = values.map((item, index) => {
    const start = offset;
    const share = total ? (item.value / total) * 100 : 0;
    offset += share;
    return {
      ...item,
      color: chartColors[index % chartColors.length]!,
      share,
      width: max ? (item.value / max) * 100 : 0,
      start,
      end: offset,
    };
  });
  return {
    total,
    segments,
    gradient: total
      ? `conic-gradient(${segments.map((item) => `${item.color} ${item.start}% ${item.end}%`).join(', ')})`
      : '#e7eceb',
  };
}
