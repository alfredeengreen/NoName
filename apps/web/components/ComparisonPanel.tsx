'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ComparisonConfig } from '@analytics/shared';

interface ComparisonPanelProps {
  siteId: string;
  onComparisonChange?: (comparison: ComparisonConfig | null) => void;
}

export default function ComparisonPanel({ siteId, onComparisonChange }: ComparisonPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [comparison, setComparison] = useState<ComparisonConfig | null>(null);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load comparison from URL
    const comparisonParam = searchParams.get('comparison');
    if (comparisonParam) {
      try {
        const parsed = JSON.parse(comparisonParam);
        setComparison(parsed);
      } catch (e) {
        console.error('Error parsing comparison from URL:', e);
      }
    }

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

  const updateComparison = (newComparison: ComparisonConfig | null) => {
    setComparison(newComparison);
    
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    if (newComparison) {
      params.set('comparison', JSON.stringify(newComparison));
    } else {
      params.delete('comparison');
    }
    router.push(`?${params.toString()}`, { scroll: false });
    
    // Notify parent
    onComparisonChange?.(newComparison || null);
  };

  const handleTypeChange = (type: ComparisonConfig['type']) => {
    const baseConfig: ComparisonConfig = {
      type,
      config: {},
    };

    // Set default config based on type
    switch (type) {
      case 'segment':
        baseConfig.config.segmentIds = [];
        break;
      case 'traffic_source':
        baseConfig.config.trafficSources = [];
        break;
      case 'device':
        baseConfig.config.deviceCategories = [];
        break;
      case 'conversion_status':
        baseConfig.config.conversionEvent = 'purchase';
        break;
      case 'time_period':
        baseConfig.config.previousPeriod = true;
        break;
      case 'custom':
        baseConfig.config.dimension = '';
        baseConfig.config.values = [];
        break;
    }

    updateComparison(baseConfig);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <span>Comparisons</span>
          {comparison && (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
              Active
            </span>
          )}
          <span>{isOpen ? '▼' : '▶'}</span>
        </button>
        {isOpen && comparison && (
          <button
            onClick={() => updateComparison(null)}
            className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
            type="button"
          >
            Clear
          </button>
        )}
      </div>

      {isOpen && (
        <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comparison Type
            </label>
            <select
              value={comparison?.type || ''}
              onChange={(e) => handleTypeChange(e.target.value as ComparisonConfig['type'])}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">No comparison</option>
              <option value="time_period">Previous Period</option>
              <option value="segment">Segment</option>
              <option value="traffic_source">Traffic Source</option>
              <option value="device">Device Category</option>
              <option value="conversion_status">Conversion Status</option>
              <option value="custom">Custom Dimension</option>
            </select>
          </div>

          {comparison && (
            <div className="space-y-3">
              {comparison.type === 'segment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Segments
                  </label>
                  <div className="space-y-2">
                    {segments.map((seg) => (
                      <label key={seg.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={comparison.config.segmentIds?.includes(seg.id) || false}
                          onChange={(e) => {
                            const segmentIds = comparison.config.segmentIds || [];
                            if (e.target.checked) {
                              updateComparison({
                                ...comparison,
                                config: { ...comparison.config, segmentIds: [...segmentIds, seg.id] },
                              });
                            } else {
                              updateComparison({
                                ...comparison,
                                config: {
                                  ...comparison.config,
                                  segmentIds: segmentIds.filter((id) => id !== seg.id),
                                },
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{seg.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {comparison.type === 'traffic_source' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Traffic Sources
                  </label>
                  <div className="space-y-2">
                    {['direct', 'organic', 'paid', 'social', 'referral'].map((source) => (
                      <label key={source} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={comparison.config.trafficSources?.includes(source) || false}
                          onChange={(e) => {
                            const sources = comparison.config.trafficSources || [];
                            if (e.target.checked) {
                              updateComparison({
                                ...comparison,
                                config: { ...comparison.config, trafficSources: [...sources, source] },
                              });
                            } else {
                              updateComparison({
                                ...comparison,
                                config: {
                                  ...comparison.config,
                                  trafficSources: sources.filter((s) => s !== source),
                                },
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm capitalize">{source}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {comparison.type === 'device' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Device Categories
                  </label>
                  <div className="space-y-2">
                    {['desktop', 'mobile', 'tablet'].map((device) => (
                      <label key={device} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={comparison.config.deviceCategories?.includes(device) || false}
                          onChange={(e) => {
                            const devices = comparison.config.deviceCategories || [];
                            if (e.target.checked) {
                              updateComparison({
                                ...comparison,
                                config: { ...comparison.config, deviceCategories: [...devices, device] },
                              });
                            } else {
                              updateComparison({
                                ...comparison,
                                config: {
                                  ...comparison.config,
                                  deviceCategories: devices.filter((d) => d !== device),
                                },
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm capitalize">{device}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {comparison.type === 'conversion_status' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Conversion Event
                  </label>
                  <input
                    type="text"
                    value={comparison.config.conversionEvent || ''}
                    onChange={(e) =>
                      updateComparison({
                        ...comparison,
                        config: { ...comparison.config, conversionEvent: e.target.value },
                      })
                    }
                    placeholder="e.g., purchase"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

