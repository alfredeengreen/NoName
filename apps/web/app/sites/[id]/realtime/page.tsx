'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MetricCard from '@/components/MetricCard';
import ChartContainer from '@/components/ChartContainer';

interface RealtimeData {
  activeUsers: number;
  topPages: Array<{ path: string; pageviews: number; activeUsers: number }>;
  topEvents: Array<{ eventName: string; count: number; activeUsers: number }>;
  topReferrers: Array<{ referrer: string; count: number; activeUsers: number }>;
  geoData: Array<{ country: string; count: number; activeUsers: number }>;
  devices: Array<{ deviceCategory: string; count: number; activeUsers: number }>;
  activityFeed?: Array<{ timestamp: Date; path: string; eventName: string; eventType: string; country?: string; deviceCategory?: string; referrer?: string }>;
  activeSessions?: Array<{ sessionId: string; startTime: Date; lastActivity: Date; eventCount: number; pages: string[]; country?: string; deviceCategory?: string; referrer?: string }>;
  errorRate?: { errorCount: number; totalEvents: number; errorRate: number };
  conversions?: Array<{ timestamp: Date; path: string; eventName: string; value?: number; currency?: string; country?: string; deviceCategory?: string }>;
  utmCampaigns?: Array<{ campaign: string; source: string; medium: string; count: number; activeUsers: number }>;
  timeWindow: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

export default function RealtimePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const minutes = parseInt(searchParams.get('minutes') || '30', 10);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/realtime?minutes=${minutes}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching realtime data:', error);
      setData(null);
      setLoading(false);
    }
  }, [siteId, minutes]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return <div className="p-8">Loading realtime data...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading realtime data</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Realtime</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last {minutes} minutes • Auto-refreshing every 30 seconds
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/sites/${siteId}/realtime?minutes=5`)}
            className={`px-3 py-1 text-sm border rounded ${minutes === 5 ? 'bg-blue-600 text-white' : ''}`}
          >
            5 min
          </button>
          <button
            onClick={() => router.push(`/sites/${siteId}/realtime?minutes=30`)}
            className={`px-3 py-1 text-sm border rounded ${minutes === 30 ? 'bg-blue-600 text-white' : ''}`}
          >
            30 min
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Active Users Right Now"
          value={data.activeUsers}
          subtitle={`Users active in last ${minutes} minutes`}
        />
        {data.errorRate && (
          <MetricCard
            title="Error Rate"
            value={`${data.errorRate.errorRate.toFixed(2)}%`}
            subtitle={`${data.errorRate.errorCount} errors in ${data.errorRate.totalEvents} events`}
          />
        )}
        {data.conversions && (
          <MetricCard
            title="Recent Conversions"
            value={data.conversions.length}
            subtitle={`In last ${minutes} minutes`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer height={300}>
          <BarChart data={data.topPages}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="path" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="pageviews" fill="#8884d8" name="Pageviews" />
            <Bar dataKey="activeUsers" fill="#82ca9d" name="Active Users" />
          </BarChart>
        </ChartContainer>

        <ChartContainer height={300}>
          <PieChart>
            <Pie
              data={data.devices}
              dataKey="activeUsers"
              nameKey="deviceCategory"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ deviceCategory, activeUsers }) => `${deviceCategory}: ${activeUsers}`}
            >
              {data.devices.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer height={300}>
          <BarChart data={data.topEvents}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="eventName" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#ffc658" name="Event Count" />
          </BarChart>
        </ChartContainer>

        <ChartContainer height={300}>
          <BarChart data={data.topReferrers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="referrer" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#ff7300" name="Events" />
          </BarChart>
        </ChartContainer>
      </div>

      <ChartContainer height={300}>
        <BarChart data={data.geoData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="country" type="category" width={60} />
          <Tooltip />
          <Bar dataKey="activeUsers" fill="#0088fe" name="Active Users" />
        </BarChart>
      </ChartContainer>

      {/* Live Activity Feed */}
      {data.activityFeed && data.activityFeed.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Live Activity Feed</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.activityFeed.slice(0, 20).map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-mono text-xs">{activity.path}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                    {activity.eventName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {activity.country && <span>{activity.country}</span>}
                  {activity.deviceCategory && <span>{activity.deviceCategory}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions */}
      {data.activeSessions && data.activeSessions.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Active Sessions</h2>
          <div className="space-y-3">
            {data.activeSessions.slice(0, 10).map((session) => (
              <div key={session.sessionId} className="p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{session.sessionId.substring(0, 8)}...</span>
                    <span className="text-xs text-muted-foreground">
                      {session.eventCount} events
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Last: {new Date(session.lastActivity).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {session.pages.slice(0, 5).map((page, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                      {page}
                    </span>
                  ))}
                  {session.pages.length > 5 && (
                    <span className="text-xs text-muted-foreground">+{session.pages.length - 5} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Conversions */}
      {data.conversions && data.conversions.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Conversions</h2>
          <div className="space-y-2">
            {data.conversions.slice(0, 10).map((conversion, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-green-600 font-semibold">{conversion.eventName}</span>
                  <span className="font-mono text-xs">{conversion.path}</span>
                  {conversion.value && (
                    <span className="font-semibold text-green-700">
                      {conversion.currency || '$'}{conversion.value.toFixed(2)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(conversion.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UTM Campaigns */}
      {data.utmCampaigns && data.utmCampaigns.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Active UTM Campaigns</h2>
          <div className="space-y-2">
            {data.utmCampaigns.map((campaign, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-semibold">{campaign.campaign}</div>
                  <div className="text-sm text-muted-foreground">
                    {campaign.source} / {campaign.medium}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{campaign.count}</div>
                  <div className="text-xs text-muted-foreground">{campaign.activeUsers} users</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

