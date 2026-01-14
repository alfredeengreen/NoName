'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import MetricCard from '@/components/MetricCard';

interface LTVData {
  channel?: string;
  cohortDate?: string;
  visitors: number;
  payingVisitors: number;
  totalRevenue: number;
  avgLTV: number;
  avgSessions?: number;
  avgActiveDays?: number;
}

export default function LTVPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<LTVData[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'channel' | 'cohort'>('channel');

  useEffect(() => {
    fetchLTV();
  }, [siteId, groupBy, searchParams]);

  const fetchLTV = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/ltv?start=${start}&end=${end}&groupBy=${groupBy}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      // Ensure data is always an array
      setData(Array.isArray(json) ? json : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching LTV:', error);
      setData([]); // Set to empty array on error
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading LTV analysis...</div>;
  }

  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];

  const totalRevenue = safeData.reduce((sum, d) => sum + (d.totalRevenue || 0), 0);
  const totalVisitors = safeData.reduce((sum, d) => sum + (d.visitors || 0), 0);
  const avgLTV = totalVisitors > 0 ? totalRevenue / totalVisitors : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lifetime Value Analysis</h1>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as 'channel' | 'cohort')}
          className="border rounded-md p-2"
        >
          <option value="channel">By Channel</option>
          <option value="cohort">By Cohort</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
        />
        <MetricCard
          title="Total Visitors"
          value={totalVisitors.toLocaleString()}
        />
        <MetricCard
          title="Average LTV"
          value={`$${avgLTV.toFixed(2)}`}
        />
      </div>

      {groupBy === 'channel' ? (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-4">Average LTV by Channel</h3>
            <ChartContainer height={400}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="avgLTV" fill="#8884d8" name="Avg LTV" />
              </BarChart>
            </ResponsiveContainer>
                    </ChartContainer>
        </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Channel Performance</h2>
            <DataTable
              data={safeData}
              columns={[
                { header: 'Channel', accessorKey: 'channel' },
                { header: 'Visitors', accessorKey: 'visitors' },
                { header: 'Paying Visitors', accessorKey: 'payingVisitors' },
                { header: 'Total Revenue', accessorKey: 'totalRevenue', cell: (row) => `$${row.totalRevenue.toFixed(2)}` },
                { header: 'Avg LTV', accessorKey: 'avgLTV', cell: (row) => `$${row.avgLTV.toFixed(2)}` },
                { header: 'Avg Sessions', accessorKey: 'avgSessions', cell: (row) => row.avgSessions?.toFixed(1) || '-' },
              ]}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-4">LTV by Cohort</h3>
            <ChartContainer height={400}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cohortDate" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgLTV" stroke="#8884d8" name="Avg LTV" />
                <Line type="monotone" dataKey="totalRevenue" stroke="#82ca9d" name="Total Revenue" />
              </LineChart>
            </ResponsiveContainer>
                    </ChartContainer>
        </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Cohort Performance</h2>
            <DataTable
              data={safeData}
              columns={[
                { header: 'Cohort Date', accessorKey: 'cohortDate' },
                { header: 'Visitors', accessorKey: 'visitors' },
                { header: 'Paying Visitors', accessorKey: 'payingVisitors' },
                { header: 'Total Revenue', accessorKey: 'totalRevenue', cell: (row) => `$${row.totalRevenue.toFixed(2)}` },
                { header: 'Avg LTV', accessorKey: 'avgLTV', cell: (row) => `$${row.avgLTV.toFixed(2)}` },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

