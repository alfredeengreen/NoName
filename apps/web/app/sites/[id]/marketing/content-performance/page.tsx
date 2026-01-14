'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';

interface ContentPerformance {
  path: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  revenue_per_visitor: number;
  avg_pageviews_per_session: number;
}

export default function ContentPerformancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<ContentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContentPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchContentPerformance = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/marketing/content-performance?start=${start}&end=${end}`);
      const json = await res.json();
      setData(Array.isArray(json.content) ? json.content.map((c: any) => ({
        ...c,
        conversion_rate: Number(c.conversion_rate || 0),
        revenue: Number(c.revenue || 0),
        revenue_per_visitor: Number(c.revenue_per_visitor || 0),
        avg_pageviews_per_session: Number(c.avg_pageviews_per_session || 0),
      })) : []);
    } catch (error) {
      console.error('Error fetching content performance:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading content performance...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Content Performance</h1>

      {/* Top Converting Pages */}
      {data.length > 0 && (
        <div>
            <h3 className="text-lg font-semibold mb-4">Top Converting Pages</h3>
            <ChartContainer height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="path" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="conversion_rate" fill="#8884d8" name="Conversion Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
                  </ChartContainer>
        </div>
      )}

      {/* Content Performance Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <DataTable
          data={data}
          columns={[
            { key: 'path', label: 'Page', sortable: true },
            { key: 'visitors', label: 'Visitors', sortable: true },
            { key: 'sessions', label: 'Sessions', sortable: true },
            { key: 'pageviews', label: 'Pageviews', sortable: true },
            { key: 'conversions', label: 'Conversions', sortable: true },
            { key: 'conversion_rate', label: 'Conversion Rate (%)', sortable: true, render: (value) => `${Number(value).toFixed(1)}%` },
            { key: 'revenue', label: 'Revenue', sortable: true, render: (value) => `$${Number(value).toFixed(2)}` },
            { key: 'revenue_per_visitor', label: 'Rev/Visitor', sortable: true, render: (value) => `$${Number(value).toFixed(2)}` },
          ]}
          keyExtractor={(row) => row.path}
          pagination={{ pageSize: 20 }}
        />
      </div>

      {data.length === 0 && (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          No content performance data available.
        </div>
      )}
    </div>
  );
}

