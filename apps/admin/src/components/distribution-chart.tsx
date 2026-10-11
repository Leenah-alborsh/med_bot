'use client';

import { useId, useState } from 'react';
import { BarChart3, ChartPie } from 'lucide-react';
import { chartSegments, type ChartItem } from '../lib/chart-data';

export function DistributionChart({
  title,
  items,
  unit = 'طالب',
  allowDonut = true,
}: {
  title: string;
  items: ChartItem[];
  unit?: string;
  allowDonut?: boolean;
}) {
  const id = useId();
  const [mode, setMode] = useState<'bars' | 'donut'>('bars');
  const { total, segments, gradient } = chartSegments(items);
  const number = new Intl.NumberFormat('ar');
  return (
    <section className="analytics-section" aria-labelledby={id}>
      <header className="analytics-heading">
        <h2 id={id}>{title}</h2>
        {allowDonut && (
          <div className="chart-mode" role="group" aria-label={`طريقة عرض ${title}`}>
            <button
              type="button"
              title="مخطط أعمدة"
              aria-label="مخطط أعمدة"
              aria-pressed={mode === 'bars'}
              onClick={() => setMode('bars')}
            >
              <BarChart3 size={17} />
            </button>
            <button
              type="button"
              title="مخطط دائري"
              aria-label="مخطط دائري"
              aria-pressed={mode === 'donut'}
              onClick={() => setMode('donut')}
            >
              <ChartPie size={17} />
            </button>
          </div>
        )}
      </header>
      {!total ? (
        <div className="chart-empty">
          <BarChart3 size={32} />
          <p>لا توجد بيانات بعد</p>
        </div>
      ) : (
        <div className={`distribution distribution-${mode}`}>
          {mode === 'donut' && (
            <div className="donut-chart" aria-hidden="true" style={{ background: gradient }}>
              <div>
                <strong>{number.format(total)}</strong>
                <span>{unit}</span>
              </div>
            </div>
          )}
          <ul className="chart-rows">
            {segments.map((item) => (
              <li
                key={item.id}
                title={`${item.label}: ${number.format(item.value)} ${unit} (${number.format(Math.round(item.share))}٪)`}
              >
                <div className="chart-row-heading">
                  <span>
                    <i style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <strong>
                    {number.format(item.value)}
                    <small>
                      {mode === 'donut' ? `${number.format(Math.round(item.share))}٪` : unit}
                    </small>
                  </strong>
                </div>
                {mode === 'bars' && (
                  <div className="bar-track" aria-hidden="true">
                    <div style={{ width: `${item.width}%`, background: item.color }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
