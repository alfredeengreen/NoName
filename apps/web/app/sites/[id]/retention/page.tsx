'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';

interface RetentionData {
  cohortDate: string;
  d0Total: number;
  retention: Record<number, number>;
}

export default function RetentionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<RetentionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRetention();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchRetention = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/retention?start=${start}&end=${end}&days=1,7,30`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      // Ensure data is always an array
      setData(Array.isArray(json) ? json : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching retention:', error);
      setData([]); // Set to empty array on error
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading retention analysis...</div>;
  }

  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];

  // Transform data for chart
  const chartData = safeData.map((cohort) => ({
    cohort: cohort.cohortDate,
    'D1': cohort.retention[1] || 0,
    'D7': cohort.retention[7] || 0,
    'D30': cohort.retention[30] || 0,
    total: cohort.d0Total,
  }));

  // Calculate averages
  const avgD1 = safeData.length > 0 ? safeData.reduce((sum, d) => sum + (d.retention[1] || 0), 0) / safeData.length : 0;
  const avgD7 = safeData.length > 0 ? safeData.reduce((sum, d) => sum + (d.retention[7] || 0), 0) / safeData.length : 0;
  const avgD30 = safeData.length > 0 ? safeData.reduce((sum, d) => sum + (d.retention[30] || 0), 0) / safeData.length : 0;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Retention Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Average D1 Retention</div>
          <div className="text-2xl font-bold">{avgD1.toFixed(1)}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Average D7 Retention</div>
          <div className="text-2xl font-bold">{avgD7.toFixed(1)}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Average D30 Retention</div>
          <div className="text-2xl font-bold">{avgD30.toFixed(1)}%</div>
        </div>
      </div>

      <div>
            <h3 className="text-lg font-semibold mb-4">Retention by Cohort</h3>
            <ChartContainer height={400}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.slice(0, 30)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cohort" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="D1" fill="#8884d8" name="D1 Retention" />
            <Bar dataKey="D7" fill="#82ca9d" name="D7 Retention" />
            <Bar dataKey="D30" fill="#ffc658" name="D30 Retention" />
          </BarChart>
        </ResponsiveContainer>
                </ChartContainer>
        </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Cohort Date</th>
              <th className="px-4 py-3 text-right">D0 Total</th>
              <th className="px-4 py-3 text-right">D1 Retention</th>
              <th className="px-4 py-3 text-right">D7 Retention</th>
              <th className="px-4 py-3 text-right">D30 Retention</th>
            </tr>
          </thead>
          <tbody>
            {safeData.slice(0, 30).map((cohort) => (
              <tr key={cohort.cohortDate} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{cohort.cohortDate}</td>
                <td className="px-4 py-3 text-right">{cohort.d0Total.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{(cohort.retention[1] || 0).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{(cohort.retention[7] || 0).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{(cohort.retention[30] || 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

