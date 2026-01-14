'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import DimensionSelector from '@/components/DimensionSelector';
import MetricSelector from '@/components/MetricSelector';
import FilterBuilder from '@/components/FilterBuilder';
import VisualizationSelector, { VisualizationType } from '@/components/VisualizationSelector';
import DataTable from '@/components/DataTable';
import ChartContainer from '@/components/ChartContainer';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Filter {
  id: string;
  dimension?: string;
  metric?: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'regex';
  value: string | number | [number, number];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f'];

export default function ExplorePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  
  const [dimensions, setDimensions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [visualization, setVisualization] = useState<VisualizationType>('table');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/app/api/sites/${siteId}/explore`)
      .then((res) => res.json())
      .then((data) => {
        setDimensions(data.dimensions || []);
        setMetrics(data.metrics || []);
        
        // Check for pre-filled query from search after dimensions/metrics are loaded
        const queryParam = searchParams.get('query');
        if (queryParam) {
          try {
            const queryConfig = JSON.parse(queryParam);
            if (queryConfig.dimensions) {
              setSelectedDimensions(queryConfig.dimensions);
            }
            if (queryConfig.metrics) {
              setSelectedMetrics(queryConfig.metrics);
            }
            if (queryConfig.filters) {
              setFilters(
                queryConfig.filters.map((f: any) => ({
                  id: nanoid(),
                  dimension: f.dimension,
                  metric: f.metric,
                  operator: f.operator || 'equals',
                  value: f.value,
                }))
              );
            }
            if (queryConfig.visualization) {
              setVisualization(queryConfig.visualization);
            }
            // Auto-execute if query is provided
            setTimeout(() => {
              executeQuery();
            }, 500);
          } catch (error) {
            console.error('Error parsing query param:', error);
          }
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams]);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use time range from query config if available, otherwise from URL params
      const queryParam = searchParams.get('query');
      let timeRange;
      if (queryParam) {
        try {
          const queryConfig = JSON.parse(queryParam);
          if (queryConfig.timeRange) {
            timeRange = {
              start: new Date(queryConfig.timeRange.start),
              end: new Date(queryConfig.timeRange.end),
            };
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      if (!timeRange) {
        const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const end = searchParams.get('end') || new Date().toISOString();
        timeRange = {
          start: new Date(start),
          end: new Date(end),
        };
      }

      const queryConfig = {
        timeRange,
        dimensions: selectedDimensions.length > 0 ? selectedDimensions : ['path'],
        metrics: selectedMetrics.length > 0 ? selectedMetrics : ['unique_visitors'],
        filters: filters.map((f) => ({
          dimension: f.dimension,
          metric: f.metric,
          operator: f.operator,
          value: f.value,
        })),
        limit: 100,
      };

      const res = await fetch(`/app/api/sites/${siteId}/explore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryConfig),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error executing query');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;

    const headers = [...selectedDimensions, ...selectedMetrics];
    const csv = [
      headers.join(','),
      ...results.map((row) =>
        headers.map((h) => {
          const val = row[h];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-query-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Query Explorer</h1>
        <div className="flex gap-2">
          <button
            onClick={executeQuery}
            disabled={loading || selectedDimensions.length === 0 || selectedMetrics.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running...' : 'Run Query'}
          </button>
          {results.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <DimensionSelector
            dimensions={dimensions}
            selected={selectedDimensions}
            onSelect={(dim) => setSelectedDimensions([...selectedDimensions, dim])}
            onRemove={(dim) => setSelectedDimensions(selectedDimensions.filter((d) => d !== dim))}
          />

          <MetricSelector
            metrics={metrics}
            selected={selectedMetrics}
            onSelect={(metric) => setSelectedMetrics([...selectedMetrics, metric])}
            onRemove={(metric) => setSelectedMetrics(selectedMetrics.filter((m) => m !== metric))}
          />

          <FilterBuilder
            filters={filters}
            dimensions={dimensions}
            onAdd={() => setFilters([...filters, { id: nanoid(), operator: 'equals', value: '' }])}
            onUpdate={(id, updates) =>
              setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)))
            }
            onRemove={(id) => setFilters(filters.filter((f) => f.id !== id))}
          />

          <VisualizationSelector
            selected={visualization}
            onSelect={setVisualization}
          />
        </div>

        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="bg-white p-8 rounded shadow text-center">
              <div>Running query...</div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded shadow">
                <div className="text-sm text-gray-600 mb-2">Results: {results.length} rows</div>
              </div>

              {visualization === 'table' && (
                <DataTable
                  data={results}
                  columns={[
                    ...selectedDimensions.map((d) => ({
                      key: d,
                      label: dimensions.find((dim) => dim.key === d)?.label || d,
                      sortable: true,
                    })),
                    ...selectedMetrics.map((m) => ({
                      key: m,
                      label: metrics.find((met) => met.key === m)?.label || m,
                      sortable: true,
                      render: (value: any) => typeof value === 'number' ? value.toLocaleString() : value,
                    })),
                  ]}
                  keyExtractor={(row) => String(row.id || JSON.stringify(row))}
                />
              )}

              {visualization === 'line' && selectedDimensions.length > 0 && (
                <ChartContainer height={400}>
                  <LineChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={selectedDimensions[0]} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedMetrics.map((metric, idx) => (
                      <Line
                        key={metric}
                        type="monotone"
                        dataKey={metric}
                        stroke={COLORS[idx % COLORS.length]}
                        name={metrics.find((m) => m.key === metric)?.label || metric}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              )}

              {visualization === 'bar' && selectedDimensions.length > 0 && (
                <ChartContainer height={400}>
                  <BarChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={selectedDimensions[0]} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedMetrics.map((metric, idx) => (
                      <Bar
                        key={metric}
                        dataKey={metric}
                        fill={COLORS[idx % COLORS.length]}
                        name={metrics.find((m) => m.key === metric)?.label || metric}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              )}

              {visualization === 'pie' && selectedDimensions.length > 0 && selectedMetrics.length > 0 && (
                <ChartContainer height={400}>
                  <PieChart>
                    <Pie
                      data={results}
                      dataKey={selectedMetrics[0]}
                      nameKey={selectedDimensions[0]}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {results.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ChartContainer>
              )}

              {visualization === 'area' && selectedDimensions.length > 0 && (
                <ChartContainer height={400}>
                  <AreaChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={selectedDimensions[0]} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedMetrics.map((metric, idx) => (
                      <Area
                        key={metric}
                        type="monotone"
                        dataKey={metric}
                        stackId="1"
                        stroke={COLORS[idx % COLORS.length]}
                        fill={COLORS[idx % COLORS.length]}
                        name={metrics.find((m) => m.key === metric)?.label || metric}
                      />
                    ))}
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="bg-white p-8 rounded shadow text-center text-gray-500">
              Select dimensions and metrics, then click &quot;Run Query&quot; to see results.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

