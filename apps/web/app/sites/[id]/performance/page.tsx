'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';

interface PerformanceData {
  slowest: Array<{
    name: string;
    avg_duration: number;
    max_duration: number;
    min_duration: number;
    count: number;
    error_count: number;
  }>;
  errorRates: Array<{
    name: string;
    total: number;
    errors: number;
    error_rate: number;
  }>;
  trends: Array<{
    hour: string;
    avg_duration: number;
    count: number;
  }>;
}

export default function PerformancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'api' | 'resource' | 'navigation'>('api');

  useEffect(() => {
    fetchPerformance();
  }, [siteId, type, searchParams]);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/performance?start=${start}&end=${end}&type=${type}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setData({
        slowest: Array.isArray(json.slowest) ? json.slowest : [],
        errorRates: Array.isArray(json.errorRates) ? json.errorRates : [],
        trends: Array.isArray(json.trends) ? json.trends : [],
      });
    } catch (error) {
      console.error('Error fetching performance data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading performance data...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading performance data</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance Monitoring</h1>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="border rounded-md p-2"
        >
          <option value="api">API Calls</option>
          <option value="resource">Resources</option>
          <option value="navigation">Navigation</option>
        </select>
      </div>

      {/* Performance Trends */}
      {data.trends.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">{type.toUpperCase()} Performance Trends</h3>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg_duration" stroke="#8884d8" name="Avg Duration (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Slowest Endpoints */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Slowest {type === 'api' ? 'Endpoints' : type === 'resource' ? 'Resources' : 'Pages'}</h2>
        <div className="bg-white rounded shadow overflow-hidden">
          <DataTable
            data={data.slowest}
            columns={[
              { key: 'name', label: 'Name', sortable: true },
              { key: 'avg_duration', label: 'Avg Duration (ms)', sortable: true },
              { key: 'max_duration', label: 'Max Duration (ms)', sortable: true },
              { key: 'count', label: 'Count', sortable: true },
              { key: 'error_count', label: 'Errors', sortable: true },
            ]}
            keyExtractor={(row) => row.name}
            pagination={{ pageSize: 20 }}
          />
        </div>
      </div>

      {/* Error Rates */}
      {data.errorRates.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Error Rates by {type === 'api' ? 'Endpoint' : type === 'resource' ? 'Resource' : 'Page'}</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.errorRates.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="error_rate" fill="#ef4444" name="Error Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}

