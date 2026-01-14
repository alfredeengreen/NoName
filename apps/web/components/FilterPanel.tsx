'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FilterConfig } from '@analytics/shared';

interface FilterPanelProps {
  siteId: string;
  onFiltersChange?: (filters: FilterConfig[]) => void;
}

interface Dimension {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
}

const STANDARD_DIMENSIONS: Dimension[] = [
  { key: 'path', label: 'Page Path', type: 'string' },
  { key: 'device_category', label: 'Device Category', type: 'string' },
  { key: 'country', label: 'Country', type: 'string' },
  { key: 'os', label: 'Operating System', type: 'string' },
  { key: 'browser_name', label: 'Browser Name', type: 'string' },
  { key: 'language', label: 'Language', type: 'string' },
  { key: 'ref_domain', label: 'Referrer Domain', type: 'string' },
  { key: 'utm_source', label: 'UTM Source', type: 'string' },
  { key: 'utm_medium', label: 'UTM Medium', type: 'string' },
  { key: 'utm_campaign', label: 'UTM Campaign', type: 'string' },
  { key: 'utm_content', label: 'UTM Content', type: 'string' },
  { key: 'utm_term', label: 'UTM Term', type: 'string' },
  { key: 'event_name', label: 'Event Name', type: 'string' },
];

const OPERATORS = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'in', label: 'in (multiple)' },
    { value: 'not_in', label: 'not in' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater than or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less than or equal' },
  ],
  boolean: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
  ],
};

export default function FilterPanel({ siteId, onFiltersChange }: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>(STANDARD_DIMENSIONS);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load filters from URL
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        const parsed = JSON.parse(filtersParam);
        setFilters(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Error parsing filters from URL:', e);
      }
    }

    // Load custom dimensions
    fetch(`/app/api/sites/${siteId}/dimensions`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const customDims = data.map((d: any) => ({
            key: `custom_dimension:${d.name}`,
            label: d.name,
            type: d.dataType || 'string',
          }));
          setDimensions([...STANDARD_DIMENSIONS, ...customDims]);
        }
      })
      .catch(console.error);

    // Load segments
    fetch(`/app/api/sites/${siteId}/segments`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSegments(data);
        }
      })
      .catch(console.error);
  }, [siteId, searchParams]);

  const updateFilters = (newFilters: FilterConfig[]) => {
    setFilters(newFilters);
    
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    if (newFilters.length > 0) {
      params.set('filters', JSON.stringify(newFilters));
    } else {
      params.delete('filters');
    }
    router.push(`?${params.toString()}`, { scroll: false });
    
    // Notify parent
    onFiltersChange?.(newFilters);
  };

  const addFilter = () => {
    const newFilter: FilterConfig = {
      dimension: 'path',
      operator: 'equals',
      value: '',
      logic: 'AND',
    };
    updateFilters([...filters, newFilter]);
  };

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    updateFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    updateFilters(newFilters);
  };

  const getDimensionType = (dimensionKey: string): 'string' | 'number' | 'boolean' => {
    const dim = dimensions.find((d) => d.key === dimensionKey);
    return dim?.type || 'string';
  };

  const getAvailableOperators = (dimensionKey: string) => {
    const type = getDimensionType(dimensionKey);
    return OPERATORS[type] || OPERATORS.string;
  };

  const renderValueInput = (filter: FilterConfig, index: number) => {
    const dimensionType = getDimensionType(filter.dimension);
    const isArrayOperator = filter.operator === 'in' || filter.operator === 'not_in';

    if (isArrayOperator) {
      return (
        <input
          type="text"
          value={Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value || '')}
          onChange={(e) => {
            const values = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
            updateFilter(index, { value: values });
          }}
          placeholder="Comma-separated values"
          className="flex-1 px-2 py-1 border rounded text-sm"
        />
      );
    }

    if (dimensionType === 'number') {
      return (
        <input
          type="number"
          value={typeof filter.value === 'number' ? filter.value : ''}
          onChange={(e) => updateFilter(index, { value: parseFloat(e.target.value) || 0 })}
          className="flex-1 px-2 py-1 border rounded text-sm"
          placeholder="Number"
        />
      );
    }

    if (dimensionType === 'boolean') {
      return (
        <select
          value={String(filter.value)}
          onChange={(e) => updateFilter(index, { value: e.target.value === 'true' })}
          className="flex-1 px-2 py-1 border rounded text-sm"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    return (
      <input
        type="text"
        value={String(filter.value || '')}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        className="flex-1 px-2 py-1 border rounded text-sm"
        placeholder="Value"
      />
    );
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <span>Filters</span>
          {filters.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
              {filters.length}
            </span>
          )}
          <span>{isOpen ? '▼' : '▶'}</span>
        </button>
        {isOpen && (
          <button
            onClick={addFilter}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            type="button"
          >
            + Add Filter
          </button>
        )}
      </div>

      {isOpen && (
        <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
          {filters.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No filters applied. Click &quot;Add Filter&quot; to get started.
            </p>
          ) : (
            filters.map((filter, index) => {
              const availableOperators = getAvailableOperators(filter.dimension);
              const showLogicToggle = index > 0;

              return (
                <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-md">
                  {showLogicToggle && (
                    <select
                      value={filter.logic || 'AND'}
                      onChange={(e) => updateFilter(index, { logic: e.target.value as 'AND' | 'OR' })}
                      className="px-2 py-1 border rounded text-sm font-semibold bg-white"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <select
                    value={filter.dimension}
                    onChange={(e) => {
                      const newDim = e.target.value;
                      const newType = getDimensionType(newDim);
                      const newOperators = OPERATORS[newType] || OPERATORS.string;
                      updateFilter(index, {
                        dimension: newDim,
                        operator: newOperators[0].value as any,
                        value: newType === 'number' ? 0 : newType === 'boolean' ? true : '',
                      });
                    }}
                    className="flex-1 px-2 py-1 border rounded text-sm bg-white"
                  >
                    <option value="">Select dimension...</option>
                    {dimensions.map((dim) => (
                      <option key={dim.key} value={dim.key}>
                        {dim.label}
                      </option>
                    ))}
                    {segments.length > 0 && (
                      <optgroup label="Segments">
                        {segments.map((seg) => (
                          <option key={seg.id} value={`segment:${seg.id}`}>
                            {seg.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, { operator: e.target.value as any })}
                    className="px-3 py-1 border rounded text-sm bg-white"
                  >
                    {availableOperators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  {renderValueInput(filter, index)}
                  <button
                    onClick={() => removeFilter(index)}
                    className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    type="button"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

