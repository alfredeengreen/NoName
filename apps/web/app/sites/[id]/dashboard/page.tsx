'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardMetricCard from '@/components/DashboardMetricCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, TrendingDown, ShoppingCart, Lightbulb, Users, ExternalLink, ArrowRight, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TimeRangeSelector from '@/components/TimeRangeSelector';
import { TeamMembersCard } from '@/components/TeamMembersCard';
import { format } from 'date-fns';
import { getApiUrl } from '@/lib/api-client';

interface DashboardData {
  errors: {
    total: number;
    unresolved: number;
    totalOccurrences: number;
    affectedUsers: number;
  };
  frustration: {
    totalEvents: number;
    affectedUsers: number;
    topTypes: Array<{ event_name: string; count: number; affected_users: number }>;
  };
  conversions: {
    revenue: number;
    transactions: number;
    avgOrderValue: number;
    conversionRate: number;
  };
  insights: {
    activeInsights: number;
    topRecommendations: Array<{ title: string; impact_estimate_pp: number; effort: number; rationale: string }>;
    baseline: {
      sessions: number;
      conversions: number;
      conversionRate: number;
      exits: number;
      exitRate: number;
    };
  };
  visitors: {
    uniqueVisitors: number;
    uniqueSessions: number;
    totalSessions: number;
    bounceRate: number;
    avgDuration: number;
  };
  topSources: {
    referrers: Array<{ source: string; count: number; uniqueVisitors: number }>;
    utmCampaigns: Array<{ source: string; medium: string; campaign: string; count: number; uniqueVisitors: number }>;
  };
  timeRange: {
    start: string;
    end: string;
  };
}

export default function DashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);

  // Ensure we're on client side before using searchParams
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get orgId from user's orgs - only on client side to prevent hydration issues
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    fetch(getApiUrl('/api/orgs'))
      .then((res) => res.json())
      .then((orgsData) => {
        if (orgsData?.orgs && orgsData.orgs.length > 0) {
          setOrgId(orgsData.orgs[0].id);
        }
      })
      .catch(console.error);
  }, [mounted]);

  useEffect(() => {
    // Only fetch on client side to prevent hydration issues
    if (!mounted || typeof window === 'undefined') return;
    
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    
    setLoading(true);
    // Properly encode the URL parameters
    const startEncoded = encodeURIComponent(start);
    const endEncoded = encodeURIComponent(end);
    fetch(getApiUrl(`/api/sites/${siteId}/dashboard?start=${startEncoded}&end=${endEncoded}`))
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
        console.error('Error loading dashboard data:', error);
        setData(null);
        setLoading(false);
      });
  }, [siteId, searchParams, mounted]);

  // Get orgId from user's orgs - only on client side to prevent hydration issues
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    fetch(getApiUrl('/api/orgs'))
      .then((res) => res.json())
      .then((orgsData) => {
        if (orgsData?.orgs && orgsData.orgs.length > 0) {
          setOrgId(orgsData.orgs[0].id);
        }
      })
      .catch(() => {
        // Silently fail - team members card will just not show
      });
  }, [mounted]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
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
          <AlertDescription>Error loading dashboard data</AlertDescription>
        </Alert>
      </div>
    );
  }

  const startDate = data.timeRange?.start ? new Date(data.timeRange.start) : new Date();
  const endDate = data.timeRange?.end ? new Date(data.timeRange.end) : new Date();
  const dateRangeText = `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            {dateRangeText}
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Team Members */}
        <div className="lg:col-span-1">
          <TeamMembersCard orgId={orgId} />
        </div>

        {/* Right Column - Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Errors Card */}
        <DashboardMetricCard
          title="Errors"
          value={data.errors.total}
          subtitle={`${data.errors.unresolved} unresolved • ${data.errors.totalOccurrences.toLocaleString()} occurrences`}
          icon={AlertTriangle}
          link={`/sites/${siteId}/errors`}
          linkLabel="View All Errors"
          variant={data.errors.unresolved > 0 ? 'error' : 'default'}
        />

        {/* Frustration Card */}
        <DashboardMetricCard
          title="Frustration Signals"
          value={data.frustration.totalEvents.toLocaleString()}
          subtitle={`${data.frustration.affectedUsers.toLocaleString()} affected users`}
          icon={TrendingDown}
          link={`/sites/${siteId}/frustration`}
          linkLabel="View Frustration Analysis"
          variant={data.frustration.totalEvents > 0 ? 'warning' : 'default'}
        />

        {/* Conversions Card */}
        <DashboardMetricCard
          title="Conversions"
          value={`$${data.conversions.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${data.conversions.transactions.toLocaleString()} transactions • ${data.conversions.conversionRate.toFixed(2)}% rate`}
          icon={ShoppingCart}
          link={`/sites/${siteId}/conversions`}
          linkLabel="View Conversions"
          variant="success"
        />

        {/* Insights Card */}
        <DashboardMetricCard
          title="Active Insights"
          value={data.insights.activeInsights}
          subtitle={`${data.insights.baseline.conversions} conversions from ${data.insights.baseline.sessions.toLocaleString()} sessions`}
          icon={Lightbulb}
          link={`/sites/${siteId}/insights`}
          linkLabel="View Insights"
          variant="info"
        />

        {/* Visitors Card */}
        <DashboardMetricCard
          title="Visitors"
          value={data.visitors.uniqueVisitors.toLocaleString()}
          subtitle={`${data.visitors.totalSessions.toLocaleString()} sessions • ${(data.visitors.bounceRate * 100).toFixed(1)}% bounce rate`}
          icon={Users}
          link={`/sites/${siteId}/overview`}
          linkLabel="View Overview"
          variant="default"
        />

      </div>

          {/* Additional Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Recommendations */}
        {data.insights.topRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Recommendations</CardTitle>
              <CardDescription>AI-generated insights to improve your site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.insights.topRecommendations.map((rec, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="font-medium text-sm">{rec.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{rec.rationale}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-blue-600">Impact: {rec.impact_estimate_pp.toFixed(1)}pp</span>
                      <span className="text-muted-foreground">Effort: {rec.effort}/5</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link href={`/sites/${siteId}/insights`}>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  View All Insights
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common tasks and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/sites/${siteId}/realtime`}>
                <Button variant="outline" className="w-full" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Realtime
                </Button>
              </Link>
              <Link href={`/sites/${siteId}/explore`}>
                <Button variant="outline" className="w-full" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Query Explorer
                </Button>
              </Link>
              <Link href={`/sites/${siteId}/reports`}>
                <Button variant="outline" className="w-full" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Reports
                </Button>
              </Link>
              <Link href={`/sites/${siteId}/alerts`}>
                <Button variant="outline" className="w-full" size="sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Alerts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

