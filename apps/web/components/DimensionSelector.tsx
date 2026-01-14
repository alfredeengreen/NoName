'use client';

interface Dimension {
  key: string;
  label: string;
  type: string;
}

interface DimensionSelectorProps {
  dimensions: Dimension[];
  selected: string[];
  onSelect: (dimension: string) => void;
  onRemove: (dimension: string) => void;
  maxSelections?: number;
}

export default function DimensionSelector({
  dimensions,
  selected,
  onSelect,
  onRemove,
  maxSelections = 5,
}: DimensionSelectorProps) {
  const available = dimensions.filter((d) => !selected.includes(d.key));

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Dimensions</label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((dim) => {
            const dimInfo = dimensions.find((d) => d.key === dim);
            return (
              <span
                key={dim}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
              >
                {dimInfo?.label || dim}
                <button
                  onClick={() => onRemove(dim)}
                  className="hover:text-blue-600"
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
          <option value="">Add dimension...</option>
          {available.map((dim) => (
            <option key={dim.key} value={dim.key}>
              {dim.label}
            </option>
          ))}
        </select>
      )}
      {selected.length >= maxSelections && (
        <p className="text-xs text-gray-500">Maximum {maxSelections} dimensions selected</p>
      )}
    </div>
  );
}


