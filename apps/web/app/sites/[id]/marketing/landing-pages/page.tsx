'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';

interface LandingPage {
  path: string;
  sessions: number;
  visitors: number;
  bounces: number;
  bounce_rate: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
  revenue_per_visitor: number;
}

export default function LandingPagesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLandingPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchLandingPages = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/marketing/landing-pages?start=${start}&end=${end}`);
      const json = await res.json();
      setData(Array.isArray(json.landingPages) ? json.landingPages.map((lp: any) => ({
        ...lp,
        bounce_rate: Number(lp.bounce_rate || 0),
        conversion_rate: Number(lp.conversion_rate || 0),
        revenue: Number(lp.revenue || 0),
        revenue_per_visitor: Number(lp.revenue_per_visitor || 0),
      })) : []);
    } catch (error) {
      console.error('Error fetching landing pages:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading landing page data...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Landing Page Performance</h1>

      {/* Conversion Rate Chart */}
      {data.length > 0 && (
        <div>
            <h3 className="text-lg font-semibold mb-4">Conversion Rate by Landing Page</h3>
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

      {/* Landing Pages Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <DataTable
          data={data}
          columns={[
            { key: 'path', label: 'Landing Page', sortable: true },
            { key: 'sessions', label: 'Sessions', sortable: true },
            { key: 'visitors', label: 'Visitors', sortable: true },
            { key: 'bounce_rate', label: 'Bounce Rate (%)', sortable: true, render: (value) => `${Number(value).toFixed(1)}%` },
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
          No landing page data available.
        </div>
      )}
    </div>
  );
}

