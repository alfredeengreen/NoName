'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import MetricCard from '@/components/MetricCard';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import FilterPanel from '@/components/FilterPanel';
import ComparisonPanel from '@/components/ComparisonPanel';
import { normalizeComparison } from '@/lib/comparison-utils';

interface ConversionsData {
  ecommerce: {
    revenue: number;
    transactions: number;
    avgOrderValue: number;
  };
  conversionEvents: Array<{ eventName: string; count: number; lastSeen: Date }>;
  funnelData: Array<{ step: number; name?: string; count: number; rate: number; dropOff: number }>;
  conversionTrends?: Array<{ date: string; totalSessions: number; convertingSessions: number; conversionRate: number }>;
  conversionByChannel?: Array<{ channel: string; totalSessions: number; convertingSessions: number; conversionRate: number }>;
  conversionByDevice?: Array<{ deviceCategory: string; totalSessions: number; convertingSessions: number; conversionRate: number }>;
  timeToConversion?: { avgHours: number; medianHours: number; minHours: number; maxHours: number };
  comparisons?: {
    revenue: { current: number; previous: number; change: number; changePercent: number };
    transactions: { current: number; previous: number; change: number; changePercent: number };
  };
}

export default function ConversionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<ConversionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = searchParams.get('end') || new Date().toISOString();
    
    setLoading(true);
    fetch(`/app/api/sites/${siteId}/conversions?start=${start}&end=${end}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch conversions data');
        }
        return res.json();
      })
      .then((data) => {
        // Ensure all required fields exist with defaults
        setData({
          ecommerce: data.ecommerce || {
            revenue: 0,
            transactions: 0,
            avgOrderValue: 0,
          },
          conversionEvents: Array.isArray(data.conversionEvents) 
            ? data.conversionEvents.map((e: any) => ({
                ...e,
                lastSeen: e.lastSeen ? new Date(e.lastSeen) : new Date(),
              }))
            : [],
          funnelData: Array.isArray(data.funnelData) ? data.funnelData : [],
          comparisons: data.comparisons,
        });
      })
      .catch((error) => {
        console.error('Error loading conversions data:', error);
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  if (loading) {
    return <div className="p-8">Loading conversions data...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading conversions data</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Conversions Overview</h1>

      {/* Filters and Comparisons */}
      <div className="space-y-4">
        <FilterPanel siteId={siteId} />
        <ComparisonPanel siteId={siteId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Revenue"
          value={`$${data.ecommerce.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          comparison={normalizeComparison(data.comparisons?.revenue)}
        />
        <MetricCard
          title="Transactions"
          value={data.ecommerce.transactions.toLocaleString()}
          comparison={normalizeComparison(data.comparisons?.transactions)}
        />
        <MetricCard
          title="Avg. Order Value"
          value={`$${data.ecommerce.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Conversion Funnel</h2>
        <ChartContainer height={300}>
          <BarChart data={Array.isArray(data.funnelData) ? data.funnelData : []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="step" 
              tickFormatter={(value) => {
                // Use step number directly, data should contain step names
                return `Step ${value}`;
              }}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" name="Users" />
            <Bar dataKey="rate" fill="#82ca9d" name="Conversion Rate %" />
          </BarChart>
        </ChartContainer>
        <div className="mt-4 bg-white p-4 rounded shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Step</th>
                <th className="text-right p-2">Users</th>
                <th className="text-right p-2">Conversion Rate</th>
                <th className="text-right p-2">Drop-off</th>
              </tr>
            </thead>
            <tbody>
              {data.funnelData.map((step, idx) => (
                <tr key={step.step} className="border-b">
                  <td className="p-2 font-medium">{step.name || step.step || `Step ${idx + 1}`}</td>
                  <td className="p-2 text-right">{step.count.toLocaleString()}</td>
                  <td className="p-2 text-right">{step.rate.toFixed(1)}%</td>
                  <td className="p-2 text-right text-red-600">{step.dropOff.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversion Rate Trends */}
      {data.conversionTrends && data.conversionTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate Trends</CardTitle>
            <CardDescription>Daily conversion rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.conversionTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="conversionRate" stroke="#8884d8" name="Conversion Rate %" />
                  <Line type="monotone" dataKey="convertingSessions" stroke="#82ca9d" name="Converting Sessions" />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Conversion by Channel */}
      {data.conversionByChannel && data.conversionByChannel.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rate by Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.conversionByChannel}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="conversionRate" fill="#8884d8" name="Conversion Rate %" />
                    <Bar dataKey="convertingSessions" fill="#82ca9d" name="Converting Sessions" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rate by Device</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.conversionByDevice}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="deviceCategory" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="conversionRate" fill="#8884d8" name="Conversion Rate %" />
                    <Bar dataKey="convertingSessions" fill="#82ca9d" name="Converting Sessions" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Time to Conversion */}
      {data.timeToConversion && (
        <Card>
          <CardHeader>
            <CardTitle>Time to Conversion</CardTitle>
            <CardDescription>Average time from first visit to conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Average</div>
                <div className="text-2xl font-bold">{data.timeToConversion.avgHours.toFixed(1)}h</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Median</div>
                <div className="text-2xl font-bold">{data.timeToConversion.medianHours.toFixed(1)}h</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Min</div>
                <div className="text-2xl font-bold">{data.timeToConversion.minHours.toFixed(1)}h</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Max</div>
                <div className="text-2xl font-bold">{data.timeToConversion.maxHours.toFixed(1)}h</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Conversion Events</h2>
        <DataTable
          data={data.conversionEvents}
          columns={[
            { key: 'eventName', label: 'Event Name', sortable: true },
            { 
              key: 'count', 
              label: 'Count', 
              sortable: true,
              render: (value) => value.toLocaleString(),
            },
            { 
              key: 'lastSeen', 
              label: 'Last Seen', 
              sortable: true,
              render: (value) => new Date(value).toLocaleString(),
            },
          ]}
          keyExtractor={(row) => row.eventName}
        />
      </div>
    </div>
  );
}

