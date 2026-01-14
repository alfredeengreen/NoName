'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DataTable from '@/components/DataTable';
import MetricCard from '@/components/MetricCard';
import ChartContainer from '@/components/ChartContainer';
import FilterPanel from '@/components/FilterPanel';
import ComparisonPanel from '@/components/ComparisonPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BehaviorData {
  topPages: Array<{ path: string; pageviews: number; uniqueVisitors: number; uniqueSessions: number }>;
  landingPages: Array<{ path: string; sessions: number; visitors: number }>;
  exitPages: Array<{ path: string; exits: number; visitors: number }>;
  userFlow: Array<{ entry: string; flows: Array<{ next: string; count: number }> }>;
  pagePerformance?: Array<{
    path: string;
    pageviews: number;
    uniqueVisitors: number;
    sessions: number;
    bouncedSessions: number;
    bounceRate: number;
    exitSessions: number;
    exitRate: number;
    avgScrollDepth: number;
    medianScrollDepth: number;
  }>;
  scrollDepthDistribution?: Array<{ depthRange: string; count: number; uniqueVisitors: number }>;
  pageValue?: Array<{
    path: string;
    sessions: number;
    totalValue: number;
    convertingSessions: number;
    valuePerSession: number;
  }>;
  comparisons?: {
    totalPageviews: { current: number; previous: number; change: number; changePercent: number };
  };
}

export default function BehaviorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    
    setLoading(true);
    fetch(`/app/api/sites/${siteId}/behavior?start=${start}&end=${end}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading behavior data:', error);
        setData(null);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  if (loading) {
    return <div className="p-8">Loading behavior data...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading behavior data</div>;
  }

  // Ensure all data arrays exist
  const topPages = Array.isArray(data.topPages) ? data.topPages : [];
  const landingPages = Array.isArray(data.landingPages) ? data.landingPages : [];
  const exitPages = Array.isArray(data.exitPages) ? data.exitPages : [];
  const userFlow = Array.isArray(data.userFlow) ? data.userFlow : [];

  const totalPageviews = topPages.reduce((sum, p) => sum + (p.pageviews || 0), 0);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Behavior Overview</h1>

      {/* Filters and Comparisons */}
      <div className="space-y-4">
        <FilterPanel siteId={siteId} />
        <ComparisonPanel siteId={siteId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Pageviews"
          value={totalPageviews.toLocaleString()}
          comparison={data.comparisons?.totalPageviews}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Site Content - All Pages</h2>
        <DataTable
          data={topPages}
          columns={[
            { key: 'path', label: 'Page', sortable: true },
            { key: 'pageviews', label: 'Pageviews', sortable: true },
            { key: 'uniqueVisitors', label: 'Unique Visitors', sortable: true },
            { key: 'uniqueSessions', label: 'Sessions', sortable: true },
          ]}
          keyExtractor={(row) => row.path}
          pagination={{ pageSize: 20 }}
        />
      </div>

      {/* Page Performance Metrics */}
      {data.pagePerformance && data.pagePerformance.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Page Performance Metrics</h2>
          <DataTable
            data={data.pagePerformance}
            columns={[
              { key: 'path', label: 'Page', sortable: true },
              { key: 'pageviews', label: 'Pageviews', sortable: true },
              { key: 'bounceRate', label: 'Bounce Rate %', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
              { key: 'exitRate', label: 'Exit Rate %', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
              { key: 'avgScrollDepth', label: 'Avg Scroll Depth %', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
              { key: 'medianScrollDepth', label: 'Median Scroll Depth %', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
            ]}
            keyExtractor={(row) => row.path}
            pagination={{ pageSize: 20 }}
          />
        </div>
      )}

      {/* Scroll Depth Distribution */}
      {data.scrollDepthDistribution && data.scrollDepthDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scroll Depth Distribution</CardTitle>
            <CardDescription>How far users scroll on pages</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.scrollDepthDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="depthRange" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Pageviews" />
                  <Bar dataKey="uniqueVisitors" fill="#82ca9d" name="Unique Visitors" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Page Value */}
      {data.pageValue && data.pageValue.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Page Value</h2>
          <Card>
            <CardContent className="pt-6">
              <DataTable
                data={data.pageValue}
                columns={[
                  { key: 'path', label: 'Page', sortable: true },
                  { key: 'sessions', label: 'Sessions', sortable: true },
                  { key: 'totalValue', label: 'Total Value', sortable: true, render: (value) => `$${Number(value || 0).toFixed(2)}` },
                  { key: 'convertingSessions', label: 'Converting Sessions', sortable: true },
                  { key: 'valuePerSession', label: 'Value per Session', sortable: true, render: (value) => `$${Number(value || 0).toFixed(2)}` },
                ]}
                keyExtractor={(row) => row.path}
                pagination={{ pageSize: 20 }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Landing Pages</h2>
          <DataTable
            data={landingPages}
            columns={[
              { key: 'path', label: 'Page', sortable: true },
              { key: 'sessions', label: 'Sessions', sortable: true },
              { key: 'visitors', label: 'Visitors', sortable: true },
            ]}
            keyExtractor={(row) => row.path}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Exit Pages</h2>
          <DataTable
            data={exitPages}
            columns={[
              { key: 'path', label: 'Page', sortable: true },
              { key: 'exits', label: 'Exits', sortable: true },
              { key: 'visitors', label: 'Visitors', sortable: true },
            ]}
            keyExtractor={(row) => row.path}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">User Flow</h2>
        <div className="bg-white rounded shadow p-6">
          {userFlow.slice(0, 10).map((flow, idx) => (
            <div key={idx} className="mb-6 pb-6 border-b last:border-b-0">
              <div className="font-semibold mb-2">{flow.entry}</div>
              <div className="flex flex-wrap gap-2">
                {flow.flows.map((f, fIdx) => (
                  <div key={fIdx} className="px-3 py-1 bg-gray-100 rounded text-sm">
                    → {f.next} ({f.count})
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

