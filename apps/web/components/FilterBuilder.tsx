'use client';

interface Filter {
  id: string;
  dimension?: string;
  metric?: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'regex';
  value: string | number | [number, number];
}

interface FilterBuilderProps {
  filters: Filter[];
  dimensions: Array<{ key: string; label: string }>;
  onAdd: () => void;
  onUpdate: (id: string, filter: Partial<Filter>) => void;
  onRemove: (id: string) => void;
}

export default function FilterBuilder({
  filters,
  dimensions,
  onAdd,
  onUpdate,
  onRemove,
}: FilterBuilderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Filters</label>
        <button
          onClick={onAdd}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          type="button"
        >
          + Add Filter
        </button>
      </div>
      {filters.map((filter) => (
        <div key={filter.id} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
          <select
            value={filter.dimension || ''}
            onChange={(e) => onUpdate(filter.id, { dimension: e.target.value, metric: undefined })}
            className="flex-1 px-2 py-1 border rounded text-sm"
          >
            <option value="">Select dimension...</option>
            {dimensions.map((dim) => (
              <option key={dim.key} value={dim.key}>
                {dim.label}
              </option>
            ))}
          </select>
          <select
            value={filter.operator}
            onChange={(e) => onUpdate(filter.id, { operator: e.target.value as any })}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="equals">equals</option>
            <option value="contains">contains</option>
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
          </select>
          <input
            type="text"
            value={typeof filter.value === 'object' ? filter.value.join('-') : String(filter.value)}
            onChange={(e) => onUpdate(filter.id, { value: e.target.value })}
            className="flex-1 px-2 py-1 border rounded text-sm"
            placeholder="Value"
          />
          <button
            onClick={() => onRemove(filter.id)}
            className="px-2 py-1 text-red-600 hover:text-red-800"
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}


