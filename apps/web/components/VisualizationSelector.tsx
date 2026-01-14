'use client';

export type VisualizationType = 'table' | 'line' | 'bar' | 'pie' | 'area';

interface VisualizationSelectorProps {
  selected: VisualizationType;
  onSelect: (type: VisualizationType) => void;
}

export default function VisualizationSelector({
  selected,
  onSelect,
}: VisualizationSelectorProps) {
  const types: Array<{ value: VisualizationType; label: string }> = [
    { value: 'table', label: 'Table' },
    { value: 'line', label: 'Line Chart' },
    { value: 'bar', label: 'Bar Chart' },
    { value: 'pie', label: 'Pie Chart' },
    { value: 'area', label: 'Area Chart' },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Visualization</label>
      <div className="flex gap-2">
        {types.map((type) => (
          <button
            key={type.value}
            onClick={() => onSelect(type.value)}
            className={`px-3 py-1 text-sm border rounded ${
              selected === type.value ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
            }`}
            type="button"
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}


