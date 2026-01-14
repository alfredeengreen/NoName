'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MetricCard from '@/components/MetricCard';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import FilterPanel from '@/components/FilterPanel';
import ComparisonPanel from '@/components/ComparisonPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AcquisitionData {
  trafficSources: {
    referrers: Array<{ source: string; count: number; uniqueVisitors: number }>;
    utmCampaigns: Array<{ source: string; medium: string; campaign: string; count: number; uniqueVisitors: number }>;
  };
  channelGrouping: Array<{ channel: string; sessions: number; visitors: number }>;
  utmTerms: Array<{ keyword: string; sessions: number; visitors: number }>;
  channelQuality?: Array<{
    channel: string;
    totalSessions: number;
    bouncedSessions: number;
    bounceRate: number;
    avgDuration: number;
    convertingSessions: number;
    conversionRate: number;
    qualityScore: number;
  }>;
  acquisitionTrends?: Array<{ date: string; channels: Record<string, { sessions: number; visitors: number }> }>;
  referrerQuality?: Array<{
    referrer: string;
    totalSessions: number;
    bouncedSessions: number;
    bounceRate: number;
    avgDuration: number;
    convertingSessions: number;
    conversionRate: number;
  }>;
  paidVsOrganic?: Array<{
    trafficType: string;
    totalSessions: number;
    totalVisitors: number;
    bouncedSessions: number;
    bounceRate: number;
    avgDuration: number;
    convertingSessions: number;
    conversionRate: number;
  }>;
  comparisons?: {
    totalSessions: { current: number; previous: number; change: number; changePercent: number };
    totalVisitors: { current: number; previous: number; change: number; changePercent: number };
  };
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f'];

export default function AcquisitionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<AcquisitionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    
    setLoading(true);
    fetch(`/app/api/sites/${siteId}/acquisition?start=${start}&end=${end}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch acquisition data');
        }
        return res.json();
      })
      .then((data) => {
        // Ensure all array properties are arrays
        if (data) {
          data.channelGrouping = Array.isArray(data.channelGrouping) ? data.channelGrouping : [];
          data.trafficSources = data.trafficSources || {};
          data.trafficSources.referrers = Array.isArray(data.trafficSources.referrers) ? data.trafficSources.referrers : [];
          data.trafficSources.utmCampaigns = Array.isArray(data.trafficSources.utmCampaigns) ? data.trafficSources.utmCampaigns : [];
          data.utmTerms = Array.isArray(data.utmTerms) ? data.utmTerms : [];
          setData(data);
        } else {
          setData(null);
        }
      })
      .catch((error) => {
        console.error('Error loading acquisition data:', error);
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  if (loading) {
    return <div className="p-8">Loading acquisition data...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading acquisition data</div>;
  }

  const totalSessions = data.channelGrouping.reduce((sum, c) => sum + c.sessions, 0);
  const totalVisitors = data.channelGrouping.reduce((sum, c) => sum + c.visitors, 0);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Acquisition Overview</h1>

      {/* Filters and Comparisons */}
      <div className="space-y-4">
        <FilterPanel siteId={siteId} />
        <ComparisonPanel siteId={siteId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Sessions"
          value={totalSessions.toLocaleString()}
          comparison={data.comparisons?.totalSessions}
        />
        <MetricCard
          title="Total Visitors"
          value={totalVisitors.toLocaleString()}
          comparison={data.comparisons?.totalVisitors}
        />
        <MetricCard
          title="Channels"
          value={data.channelGrouping.length}
        />
      </div>

      <ChartContainer height={300}>
        <PieChart>
          <Pie
            data={data.channelGrouping}
            dataKey="sessions"
            nameKey="channel"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ channel, sessions }) => `${channel}: ${sessions}`}
          >
            {data.channelGrouping.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer height={300}>
          <BarChart data={Array.isArray(data.channelGrouping) ? data.channelGrouping : []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
            <Bar dataKey="visitors" fill="#82ca9d" name="Visitors" />
          </BarChart>
        </ChartContainer>

        <div>
          <h2 className="text-lg font-semibold mb-4">Top Referrers</h2>
          <DataTable
            data={data.trafficSources.referrers}
            columns={[
              { key: 'source', label: 'Source', sortable: true },
              { key: 'count', label: 'Events', sortable: true },
              { key: 'uniqueVisitors', label: 'Visitors', sortable: true },
            ]}
            keyExtractor={(row) => row.source}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">UTM Campaigns</h2>
        <DataTable
          data={data.trafficSources.utmCampaigns}
          columns={[
            { key: 'campaign', label: 'Campaign', sortable: true },
            { key: 'source', label: 'Source', sortable: true },
            { key: 'medium', label: 'Medium', sortable: true },
            { key: 'count', label: 'Events', sortable: true },
            { key: 'uniqueVisitors', label: 'Visitors', sortable: true },
          ]}
          keyExtractor={(row) => `${row.campaign}-${row.source}-${row.medium}`}
        />
      </div>

      {data.utmTerms.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Top Keywords (UTM Terms)</h2>
          <DataTable
            data={data.utmTerms}
            columns={[
              { key: 'keyword', label: 'Keyword', sortable: true },
              { key: 'sessions', label: 'Sessions', sortable: true },
              { key: 'visitors', label: 'Visitors', sortable: true },
            ]}
            keyExtractor={(row) => row.keyword}
          />
        </div>
      )}

      {/* Channel Quality Score */}
      {data.channelQuality && data.channelQuality.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Channel Quality Score</CardTitle>
            <CardDescription>Quality metrics per channel (bounce rate, engagement, conversion)</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.channelQuality}
              columns={[
                { key: 'channel', label: 'Channel', sortable: true },
                { key: 'totalSessions', label: 'Sessions', sortable: true },
                { key: 'bounceRate', label: 'Bounce Rate %', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
                { key: 'avgDuration', label: 'Avg Duration (s)', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}s` },
                { key: 'conversionRate', label: 'Conversion Rate %', sortable: true, render: (value) => `${Number(value || 0).toFixed(2)}%` },
                { key: 'qualityScore', label: 'Quality Score', sortable: true, render: (value) => `${Number(value || 0).toFixed(0)}/100` },
              ]}
              keyExtractor={(row) => row.channel}
            />
          </CardContent>
        </Card>
      )}

      {/* Acquisition Trends */}
      {data.acquisitionTrends && data.acquisitionTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Acquisition Trends</CardTitle>
            <CardDescription>Channel performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.acquisitionTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {['Direct', 'Organic', 'Paid', 'Social', 'Referral'].map((channel, idx) => (
                    <Line
                      key={channel}
                      type="monotone"
                      dataKey={(d) => d.channels[channel]?.sessions || 0}
                      stroke={COLORS[idx % COLORS.length]}
                      name={channel}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Referrer Quality */}
      {data.referrerQuality && data.referrerQuality.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Referrer Quality</CardTitle>
            <CardDescription>Quality metrics for top referrers</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.referrerQuality}
              columns={[
                { key: 'referrer', label: 'Referrer', sortable: true },
                { key: 'totalSessions', label: 'Sessions', sortable: true },
                { key: 'bounceRate', label: 'Bounce Rate %', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
                { key: 'avgDuration', label: 'Avg Duration (s)', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}s` },
                { key: 'conversionRate', label: 'Conversion Rate %', sortable: true, render: (value) => `${Number(value || 0).toFixed(2)}%` },
              ]}
              keyExtractor={(row) => row.referrer}
              pagination={{ pageSize: 20 }}
            />
          </CardContent>
        </Card>
      )}

      {/* Paid vs Organic */}
      {data.paidVsOrganic && data.paidVsOrganic.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paid vs Organic Comparison</CardTitle>
            <CardDescription>Performance comparison between paid and organic traffic</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {data.paidVsOrganic.map((item) => (
                <div key={item.trafficType} className="p-4 bg-muted rounded">
                  <h3 className="font-semibold mb-4">{item.trafficType} Traffic</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Sessions</div>
                      <div className="text-lg font-bold">{item.totalSessions.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Visitors</div>
                      <div className="text-lg font-bold">{item.totalVisitors.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Bounce Rate</div>
                      <div className="text-lg font-bold">{item.bounceRate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Conversion Rate</div>
                      <div className="text-lg font-bold">{item.conversionRate.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ChartContainer height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.paidVsOrganic}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="trafficType" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalSessions" fill="#8884d8" name="Sessions" />
                  <Bar dataKey="convertingSessions" fill="#82ca9d" name="Converting Sessions" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

