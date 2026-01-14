'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MetricCard from '@/components/MetricCard';
import { normalizeComparison } from '@/lib/comparison-utils';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import FilterPanel from '@/components/FilterPanel';
import ComparisonPanel from '@/components/ComparisonPanel';

interface OverviewData {
  pageviews: Array<{ time: string; count: number }>;
  clicks: Array<{ time: string; count: number }>;
  formSubmits: Array<{ time: string; count: number }>;
  purchases: Array<{ time: string; count: number; value?: number | null }>;
  topPages: Array<{ path: string; pageviews: number; uniqueVisitors: number; uniqueSessions: number }>;
  deviceBreakdown: Array<{ deviceCategory: string; count: number; uniqueVisitors: number }>;
  osBreakdown: Array<{ os: string; count: number; uniqueVisitors: number }>;
  countryBreakdown: Array<{ country: string; count: number; uniqueVisitors: number }>;
  trafficSources: {
    referrers: Array<{ source: string; count: number; uniqueVisitors: number }>;
    utmCampaigns: Array<{ source: string; medium: string; campaign: string; count: number; uniqueVisitors: number }>;
  };
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
  ingestStats: {
    acceptedCount: number;
    droppedInvalid: number;
    droppedPii: number;
    droppedRateLimited: number;
    droppedCardinality: number;
  };
  hourlyPatterns?: Array<{ hour: number; count: number; uniqueVisitors: number }>;
  dailyPatterns?: Array<{ dayOfWeek: number; dayName: string; count: number; uniqueVisitors: number }>;
  topReferrers?: Array<{ referrer: string; pageviews: number; uniqueVisitors: number; sessions: number; engagedSessions: number; engagementRate: number }>;
  engagementScore?: number;
  trafficQualityScore?: number;
  goalProgress?: Array<{ goalId: string; goalName: string; goalType: string; conversions: number }>;
  activeUsers?: number;
  comparisons?: {
    pageviews?: { current: { value: number }; previous: { value: number }; change: number; changePercent: number };
    uniqueVisitors?: { current: { value: number }; previous: { value: number }; change: number; changePercent: number };
    uniqueSessions?: { current: { value: number }; previous: { value: number }; change: number; changePercent: number };
    bounceRate?: { current: { value: number }; previous: { value: number }; change: number; changePercent: number };
  };
}

export default function OverviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    
    setLoading(true);
    fetch(`/app/api/sites/${siteId}/overview?start=${start}&end=${end}`)
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
        console.error('Error loading overview data:', error);
        setData(null);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error loading overview</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Ensure all arrays exist with defaults
  const pageviews = Array.isArray(data.pageviews) ? data.pageviews : [];
  const clicks = Array.isArray(data.clicks) ? data.clicks : [];
  const formSubmits = Array.isArray(data.formSubmits) ? data.formSubmits : [];
  const purchases = Array.isArray(data.purchases) ? data.purchases : [];
  const topPages = Array.isArray(data.topPages) ? data.topPages : [];
  const deviceBreakdown = Array.isArray(data.deviceBreakdown) ? data.deviceBreakdown : [];
  const osBreakdown = Array.isArray(data.osBreakdown) ? data.osBreakdown : [];
  const countryBreakdown = Array.isArray(data.countryBreakdown) ? data.countryBreakdown : [];
  const trafficSources = data.trafficSources || {
    referrers: [],
    utmCampaigns: [],
  };
  const uniqueMetrics = data.uniqueMetrics || {
    uniqueVisitors: 0,
    uniqueSessions: 0,
    totalEvents: 0,
  };
  const sessionMetrics = data.sessionMetrics || {
    totalSessions: 0,
    bouncedSessions: 0,
    bounceRate: 0,
    avgDurationSeconds: 0,
  };
  const ingestStats = data.ingestStats || {
    acceptedCount: 0,
    droppedInvalid: 0,
    droppedPii: 0,
    droppedRateLimited: 0,
    droppedCardinality: 0,
  };

  // Aggregate data by hour
  const aggregateByHour = (points: Array<{ time: string; count: number }>) => {
    if (!Array.isArray(points) || points.length === 0) {
      return [];
    }
    const hourly: Record<string, number> = {};
    points.forEach((p) => {
      const date = new Date(p.time);
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      hourly[hourKey] = (hourly[hourKey] || 0) + p.count;
    });
    return Object.entries(hourly)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const pageviewData = aggregateByHour(pageviews);
  const totalPageviews = pageviews.reduce((sum, p) => sum + (p.count || 0), 0);
  const totalClicks = clicks.reduce((sum, c) => sum + (c.count || 0), 0);
  const totalFormSubmits = formSubmits.reduce((sum, f) => sum + (f.count || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.count || 0), 0);
  const totalRevenue = purchases.reduce((sum, p) => sum + (p.value || 0), 0);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Summary dashboard • View detailed reports in the navigation
          </p>
        </div>
      </div>

      {/* Filters and Comparisons */}
      <div className="space-y-4">
        <FilterPanel siteId={siteId} />
        <ComparisonPanel siteId={siteId} />
      </div>

      {/* Real-time Activity Indicator */}
      {data.activeUsers !== undefined && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Active Users Right Now</CardDescription>
                <div className="text-3xl font-bold mt-2">{data.activeUsers}</div>
                <div className="text-sm text-muted-foreground mt-1">Users active in last 5 minutes</div>
              </div>
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Pageviews"
          value={totalPageviews.toLocaleString()}
          comparison={normalizeComparison(data.comparisons?.pageviews)}
        />
        <MetricCard
          title="Unique Visitors"
          value={uniqueMetrics.uniqueVisitors.toLocaleString()}
          comparison={normalizeComparison(data.comparisons?.uniqueVisitors)}
        />
        <MetricCard
          title="Sessions"
          value={uniqueMetrics.uniqueSessions.toLocaleString()}
          comparison={normalizeComparison(data.comparisons?.uniqueSessions)}
        />
        <MetricCard
          title="Bounce Rate"
          value={`${sessionMetrics.bounceRate.toFixed(1)}%`}
          comparison={data.comparisons?.bounceRate ? {
            ...normalizeComparison(data.comparisons.bounceRate)!,
            changePercent: -(normalizeComparison(data.comparisons.bounceRate)?.changePercent || 0), // Invert for bounce rate (lower is better)
          } : undefined}
        />
        <MetricCard
          title="Avg. Session"
          value={formatDuration(sessionMetrics.avgDurationSeconds)}
        />
      </div>

      {/* Engagement & Quality Scores */}
      {(data.engagementScore !== undefined || data.trafficQualityScore !== undefined) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.engagementScore !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Engagement Score</CardTitle>
                <CardDescription>Composite metric based on bounce rate, session duration, and pages per session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">{data.engagementScore.toFixed(0)}</div>
                  <div className="flex-1">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${data.engagementScore}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Out of 100</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {data.trafficQualityScore !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Traffic Quality Score</CardTitle>
                <CardDescription>Based on bounce rate, session duration, and conversion rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">{data.trafficQualityScore.toFixed(0)}</div>
                  <div className="flex-1">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${data.trafficQualityScore}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Out of 100</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Quick Links to Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links to Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/realtime`}>
                <div className="font-semibold">Realtime</div>
                <div className="text-sm text-muted-foreground">Live activity</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/audience`}>
                <div className="font-semibold">Audience</div>
                <div className="text-sm text-muted-foreground">Demographics & tech</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/acquisition`}>
                <div className="font-semibold">Acquisition</div>
                <div className="text-sm text-muted-foreground">Traffic sources</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/behavior`}>
                <div className="font-semibold">Behavior</div>
                <div className="text-sm text-muted-foreground">Pages & flow</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/conversions`}>
                <div className="font-semibold">Conversions</div>
                <div className="text-sm text-muted-foreground">Goals & funnels</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/events`}>
                <div className="font-semibold">Events</div>
                <div className="text-sm text-muted-foreground">Event catalog</div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" asChild>
              <Link href={`/sites/${siteId}/explore`}>
                <div className="font-semibold">Query Explorer</div>
                <div className="text-sm text-muted-foreground">Custom reports</div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pageviews Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Pageviews Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {pageviewData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pageviewData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" name="Pageviews" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          )}
        </CardContent>
      </Card>

      {/* Top Pages Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Pages</CardTitle>
            <Button variant="link" size="sm" asChild>
              <Link href={`/sites/${siteId}/behavior`}>View all →</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topPages.slice(0, 5).map((page, idx) => (
              <div key={page.path} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="font-mono text-sm">{page.path}</span>
                <div className="flex gap-4 text-sm">
                  <span>{page.pageviews.toLocaleString()} views</span>
                  <span className="text-muted-foreground">{page.uniqueVisitors.toLocaleString()} visitors</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Patterns */}
      {data.hourlyPatterns && data.hourlyPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Traffic by Hour of Day</CardTitle>
            <CardDescription>Average traffic patterns throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.hourlyPatterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Pageviews" />
                <Bar dataKey="uniqueVisitors" fill="#82ca9d" name="Unique Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Patterns */}
      {data.dailyPatterns && data.dailyPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Traffic by Day of Week</CardTitle>
            <CardDescription>Average traffic patterns by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailyPatterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Pageviews" />
                <Bar dataKey="uniqueVisitors" fill="#82ca9d" name="Unique Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Referrers with Quality */}
      {data.topReferrers && data.topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
            <CardDescription>Traffic sources with engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topReferrers.map((referrer, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded">
                  <div className="flex-1">
                    <div className="font-semibold">{referrer.referrer || 'Direct'}</div>
                    <div className="text-sm text-muted-foreground">
                      {referrer.pageviews.toLocaleString()} pageviews • {referrer.uniqueVisitors.toLocaleString()} visitors
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{referrer.engagementRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Engagement</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal Progress */}
      {data.goalProgress && data.goalProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Goal Progress</CardTitle>
            <CardDescription>Progress toward configured goals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.goalProgress.map((goal) => (
                <div key={goal.goalId}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{goal.goalName}</span>
                    <span className="text-sm text-muted-foreground">{goal.conversions} conversions</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (goal.conversions / Math.max(goal.conversions, 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="link" size="sm" className="p-0 h-auto mt-4" asChild>
              <Link href={`/sites/${siteId}/goals`}>Manage Goals →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Clicks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
            <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
              <Link href={`/sites/${siteId}/behavior`}>View details →</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Form Submits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFormSubmits.toLocaleString()}</div>
            <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
              <Link href={`/sites/${siteId}/conversions`}>View details →</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
              <Link href={`/sites/${siteId}/conversions`}>View details →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
