'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';

interface FrustrationData {
  byType: Array<{
    event_name: string;
    count: number;
    affected_users: number;
  }>;
  topElements: Array<{
    selector: string;
    count: number;
  }>;
  byPath: Array<{
    path: string;
    frustration_count: number;
    affected_users: number;
  }>;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

export default function FrustrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<FrustrationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFrustration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchFrustration = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/frustration?start=${start}&end=${end}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setData({
        byType: Array.isArray(json.byType) ? json.byType : [],
        topElements: Array.isArray(json.topElements) ? json.topElements : [],
        byPath: Array.isArray(json.byPath) ? json.byPath : [],
      });
    } catch (error) {
      console.error('Error fetching frustration data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading frustration signals...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading frustration data</div>;
  }

  const totalFrustration = data.byType.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">User Frustration Signals</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Total Frustration Events</div>
          <div className="text-2xl font-bold">{totalFrustration.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Affected Users</div>
          <div className="text-2xl font-bold">
            {data.byType.reduce((sum, item) => sum + item.affected_users, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Frustration Types</div>
          <div className="text-2xl font-bold">{data.byType.length}</div>
        </div>
      </div>

      {/* Frustration by Type */}
      {data.byType.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Frustration by Type</h3>
            <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="event_name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#ef4444" name="Count" />
              </BarChart>
            </ResponsiveContainer>
                    </ChartContainer>
        </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Frustration Distribution</h3>
            <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byType}
                  dataKey="count"
                  nameKey="event_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ event_name, count }) => `${event_name.replace('frustration:', '')}: ${count}`}
                >
                  {data.byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
                    </ChartContainer>
        </div>
        </div>
      )}

      {/* Top Frustrating Elements */}
      {data.topElements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Top Frustrating Elements</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <DataTable
              data={data.topElements}
              columns={[
                { key: 'selector', label: 'Element Selector', sortable: true },
                { key: 'count', label: 'Frustration Count', sortable: true },
              ]}
              keyExtractor={(row) => row.selector}
            />
          </div>
        </div>
      )}

      {/* Frustration by Path */}
      {data.byPath.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Frustration by Page</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <DataTable
              data={data.byPath}
              columns={[
                { key: 'path', label: 'Path', sortable: true },
                { key: 'frustration_count', label: 'Frustration Count', sortable: true },
                { key: 'affected_users', label: 'Affected Users', sortable: true },
              ]}
              keyExtractor={(row) => row.path}
            />
          </div>
        </div>
      )}

      {totalFrustration === 0 && (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          No frustration signals detected.
        </div>
      )}
    </div>
  );
}

