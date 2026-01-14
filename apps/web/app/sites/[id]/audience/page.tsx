'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MetricCard from '@/components/MetricCard';
import ChartContainer from '@/components/ChartContainer';
import FilterPanel from '@/components/FilterPanel';
import ComparisonPanel from '@/components/ComparisonPanel';

interface AudienceData {
  uniqueMetrics: {
    uniqueVisitors: number;
    uniqueSessions: number;
    totalEvents: number;
  };
  sessionMetrics: {
    totalSessions: number;
    bouncedSessions: number;
    bounceRate: number;
    avgDurationSeconds: number;
  };
  deviceBreakdown: Array<{ deviceCategory: string; count: number; uniqueVisitors: number }>;
  osBreakdown: Array<{ os: string; count: number; uniqueVisitors: number }>;
  countryBreakdown: Array<{ country: string; count: number; uniqueVisitors: number }>;
  newVsReturning: {
    new: number;
    returning: number;
    total: number;
    newPercentage: number;
    returningPercentage: number;
  };
  engagementMetrics: {
    avgPagesPerSession: number;
    avgSessionDuration: number;
    medianPagesPerSession: number;
  };
  browserBreakdown?: Array<{ browserName: string; browserVersion: string; count: number; uniqueVisitors: number }>;
  screenResolutionBreakdown?: Array<{ resolution: string; count: number; uniqueVisitors: number }>;
  languageBreakdown?: Array<{ language: string; count: number; uniqueVisitors: number }>;
  connectionTypeBreakdown?: Array<{ connectionType: string; count: number; uniqueVisitors: number }>;
  frequencyAnalysis?: Array<{ frequencyCategory: string; visitorCount: number; avgVisitDays: number }>;
  recencyAnalysis?: Array<{ recencyCategory: string; visitorCount: number }>;
  timezoneAnalysis?: Array<{ hourUTC: number; count: number; uniqueVisitors: number }>;
  comparisons?: {
    uniqueMetrics: {
      uniqueVisitors: { current: number; previous: number; change: number; changePercent: number };
      uniqueSessions: { current: number; previous: number; change: number; changePercent: number };
    };
    sessionMetrics: {
      bounceRate: { current: number; previous: number; change: number; changePercent: number };
      avgDurationSeconds: { current: number; previous: number; change: number; changePercent: number };
    };
  };
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

export default function AudiencePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<AudienceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    
    fetch(`/app/api/sites/${siteId}/audience?start=${start}&end=${end}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch audience data');
        }
        return res.json();
      })
      .then((data) => {
        // Ensure all array properties are arrays
        if (data) {
          data.deviceBreakdown = Array.isArray(data.deviceBreakdown) ? data.deviceBreakdown : [];
          data.osBreakdown = Array.isArray(data.osBreakdown) ? data.osBreakdown : [];
          data.countryBreakdown = Array.isArray(data.countryBreakdown) ? data.countryBreakdown : [];
        }
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  if (loading) {
    return <div className="p-8">Loading audience data...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading audience data</div>;
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Audience Overview</h1>

      {/* Filters and Comparisons */}
      <div className="space-y-4">
        <FilterPanel siteId={siteId} />
        <ComparisonPanel siteId={siteId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Unique Visitors"
          value={(data.uniqueMetrics?.uniqueVisitors || 0).toLocaleString()}
          comparison={data.comparisons?.uniqueMetrics.uniqueVisitors}
        />
        <MetricCard
          title="Sessions"
          value={(data.uniqueMetrics?.uniqueSessions || 0).toLocaleString()}
          comparison={data.comparisons?.uniqueMetrics.uniqueSessions}
        />
        <MetricCard
          title="Bounce Rate"
          value={`${(data.sessionMetrics?.bounceRate || 0).toFixed(1)}%`}
          comparison={data.comparisons?.sessionMetrics.bounceRate ? {
            ...data.comparisons.sessionMetrics.bounceRate,
            changePercent: -data.comparisons.sessionMetrics.bounceRate.changePercent, // Invert for bounce rate (lower is better)
          } : undefined}
        />
        <MetricCard
          title="Avg. Session Duration"
          value={formatDuration(data.sessionMetrics?.avgDurationSeconds || 0)}
          comparison={data.comparisons?.sessionMetrics.avgDurationSeconds}
        />
        <MetricCard
          title="Pages per Session"
          value={(data.engagementMetrics?.avgPagesPerSession || 0).toFixed(2)}
        />
        <MetricCard
          title="New Visitors"
          value={`${(data.newVsReturning?.newPercentage || 0).toFixed(1)}%`}
          subtitle={`${(data.newVsReturning?.new || 0).toLocaleString()} of ${(data.newVsReturning?.total || 0).toLocaleString()}`}
        />
        <MetricCard
          title="Returning Visitors"
          value={`${(data.newVsReturning?.returningPercentage || 0).toFixed(1)}%`}
          subtitle={`${(data.newVsReturning?.returning || 0).toLocaleString()} of ${(data.newVsReturning?.total || 0).toLocaleString()}`}
        />
        <MetricCard
          title="Total Events"
          value={(data.uniqueMetrics?.totalEvents || 0).toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer height={300}>
          <PieChart>
            <Pie
              data={data.deviceBreakdown}
              dataKey="uniqueVisitors"
              nameKey="deviceCategory"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ deviceCategory, uniqueVisitors }) => `${deviceCategory}: ${uniqueVisitors}`}
            >
              {data.deviceBreakdown.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartContainer>

        <ChartContainer height={300}>
          <BarChart data={Array.isArray(data.osBreakdown) ? data.osBreakdown : []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="os" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="uniqueVisitors" fill="#8884d8" name="Unique Visitors" />
          </BarChart>
        </ChartContainer>
      </div>

      <ChartContainer height={300}>
        <BarChart data={Array.isArray(data.countryBreakdown) ? data.countryBreakdown : []} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="country" type="category" width={60} />
          <Tooltip />
          <Bar dataKey="uniqueVisitors" fill="#82ca9d" name="Unique Visitors" />
        </BarChart>
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer height={300}>
          <PieChart>
            <Pie
              data={[
                { name: 'New', value: data.newVsReturning?.new || 0 },
                { name: 'Returning', value: data.newVsReturning?.returning || 0 },
              ]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
            >
              <Cell fill="#8884d8" />
              <Cell fill="#82ca9d" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>

      {/* Browser Breakdown */}
      {data.browserBreakdown && data.browserBreakdown.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Browser Breakdown</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.browserBreakdown.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="browserName" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="uniqueVisitors" fill="#8884d8" name="Unique Visitors" />
                <Bar dataKey="count" fill="#82ca9d" name="Pageviews" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Screen Resolution */}
      {data.screenResolutionBreakdown && data.screenResolutionBreakdown.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Screen Resolution</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.screenResolutionBreakdown.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="resolution" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="uniqueVisitors" fill="#8884d8" name="Unique Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Language Breakdown */}
      {data.languageBreakdown && data.languageBreakdown.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Language Breakdown</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.languageBreakdown.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="language" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="uniqueVisitors" fill="#8884d8" name="Unique Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Connection Type */}
      {data.connectionTypeBreakdown && data.connectionTypeBreakdown.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Connection Type</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.connectionTypeBreakdown}
                  dataKey="uniqueVisitors"
                  nameKey="connectionType"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ connectionType, percent }) => `${connectionType}: ${(percent * 100).toFixed(1)}%`}
                >
                  {data.connectionTypeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Frequency Analysis */}
      {data.frequencyAnalysis && data.frequencyAnalysis.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Visit Frequency</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.frequencyAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="frequencyCategory" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="visitorCount" fill="#8884d8" name="Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Recency Analysis */}
      {data.recencyAnalysis && data.recencyAnalysis.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Days Since Last Visit</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.recencyAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recencyCategory" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="visitorCount" fill="#82ca9d" name="Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Timezone Analysis */}
      {data.timezoneAnalysis && data.timezoneAnalysis.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Activity by Hour (UTC)</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timezoneAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hourUTC" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#8884d8" name="Pageviews" />
                <Line type="monotone" dataKey="uniqueVisitors" stroke="#82ca9d" name="Unique Visitors" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}

