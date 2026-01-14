'use client';

import { ComparisonResult } from '@analytics/shared';
import MetricCard from './MetricCard';

interface ComparisonViewProps {
  comparisons: Record<string, ComparisonResult>;
  title?: string;
}

export default function ComparisonView({ comparisons, title }: ComparisonViewProps) {
  if (Object.keys(comparisons).length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(comparisons).map(([key, comparison]) => (
          <MetricCard
            key={key}
            title={comparison.current.label || key}
            value={comparison.current.value}
            comparison={comparison.previous ? {
              current: comparison.current.value,
              previous: comparison.previous.value,
              change: comparison.change,
              changePercent: comparison.changePercent,
            } : undefined}
          />
        ))}
      </div>
    </div>
  );
}


