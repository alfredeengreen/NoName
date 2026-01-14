'use client';

interface Metric {
  key: string;
  label: string;
  type: string;
  aggregation: string;
}

interface MetricSelectorProps {
  metrics: Metric[];
  selected: string[];
  onSelect: (metric: string) => void;
  onRemove: (metric: string) => void;
  maxSelections?: number;
}

export default function MetricSelector({
  metrics,
  selected,
  onSelect,
  onRemove,
  maxSelections = 10,
}: MetricSelectorProps) {
  const available = metrics.filter((m) => !selected.includes(m.key));

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Metrics</label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((metric) => {
            const metricInfo = metrics.find((m) => m.key === metric);
            return (
              <span
                key={metric}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
              >
                {metricInfo?.label || metric}
                <button
                  onClick={() => onRemove(metric)}
                  className="hover:text-green-600"
                  type="button"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      {available.length > 0 && selected.length < maxSelections && (
        <select
          onChange={(e) => {
            if (e.target.value) {
              onSelect(e.target.value);
              e.target.value = '';
            }
          }}
          className="w-full px-3 py-2 border rounded text-sm"
        >
          <option value="">Add metric...</option>
          {available.map((metric) => (
            <option key={metric.key} value={metric.key}>
              {metric.label}
            </option>
          ))}
        </select>
      )}
      {selected.length >= maxSelections && (
        <p className="text-xs text-gray-500">Maximum {maxSelections} metrics selected</p>
      )}
    </div>
  );
}


