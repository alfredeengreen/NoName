'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AttributionChannel {
  channel: string;
  sessions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

interface AttributionData {
  model: string;
  channels: AttributionChannel[];
  modelComparison?: Record<string, AttributionChannel[]>;
  attributionPaths?: Array<{ path: string[]; conversionCount: number; avgTouchpoints: number }>;
  timeToConversion?: { avgHours: number; medianHours: number; minHours: number; maxHours: number };
  touchpointFrequency?: Array<{ touchpointCount: number; sessionCount: number }>;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f'];

export default function AttributionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' | 'data_driven'>('last_touch');

  useEffect(() => {
    fetchAttribution();
  }, [siteId, model, searchParams]);

  const fetchAttribution = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/attribution?start=${start}&end=${end}&model=${model}`);
      if (!res.ok) {
        throw new Error('Failed to fetch attribution data');
      }
      const json = await res.json();
      // Ensure channels is always an array
      setData({
        model: json.model || model,
        channels: Array.isArray(json.channels) ? json.channels : [],
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching attribution:', error);
      setData({ model, channels: [] });
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading attribution data...</div>;
  }

  if (!data || !data.channels) {
    return <div className="p-8">Error loading attribution data</div>;
  }

  if (data.channels.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Attribution Analysis</h1>
        <p className="text-gray-500">No attribution data available for the selected time period.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attribution Analysis</h1>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as any)}
          className="border rounded-md p-2"
        >
          <option value="first_touch">First Touch</option>
          <option value="last_touch">Last Touch</option>
          <option value="linear">Linear</option>
          <option value="position_based">Position Based</option>
          <option value="time_decay">Time Decay</option>
          <option value="data_driven">Data Driven</option>
        </select>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <p className="text-sm">
          <strong>Current Model:</strong> {model.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          {model === 'first_touch' && ' - 100% credit to first touchpoint'}
          {model === 'last_touch' && ' - 100% credit to last touchpoint'}
          {model === 'linear' && ' - Equal credit to all touchpoints'}
          {model === 'position_based' && ' - 40% first, 40% last, 20% middle'}
          {model === 'time_decay' && ' - More credit to recent touchpoints'}
          {model === 'data_driven' && ' - Statistical model based on conversion patterns'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Sessions by Channel</h3>
          <ChartContainer height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.channels}
                dataKey="sessions"
                nameKey="channel"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ channel, sessions }) => `${channel}: ${sessions.toFixed(0)}`}
              >
                {data.channels.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Conversions by Channel</h3>
          <ChartContainer height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.channels}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="conversions" fill="#82ca9d" name="Conversions" />
              <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Channel Performance</h2>
        <DataTable
          data={data.channels || []}
          columns={[
            { header: 'Channel', accessorKey: 'channel' },
            { header: 'Sessions', accessorKey: 'sessions', cell: (row) => row.sessions.toFixed(1) },
            { header: 'Conversions', accessorKey: 'conversions', cell: (row) => row.conversions.toFixed(1) },
            { header: 'Conversion Rate', accessorKey: 'conversionRate', cell: (row) => `${row.conversionRate.toFixed(2)}%` },
            { header: 'Revenue', accessorKey: 'revenue', cell: (row) => `$${row.revenue.toFixed(2)}` },
          ]}
          keyExtractor={(row) => row.channel}
        />
      </div>

      {/* Model Comparison */}
      {data.modelComparison && Object.keys(data.modelComparison).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Model Comparison</CardTitle>
            <CardDescription>Compare attribution across different models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(data.modelComparison).map(([modelName, channels]) => (
                <div key={modelName}>
                  <h3 className="font-semibold mb-2 capitalize">{modelName.replace('_', ' ')}</h3>
                  <DataTable
                    data={channels.slice(0, 5)}
                    columns={[
                      { header: 'Channel', accessorKey: 'channel' },
                      { header: 'Conversions', accessorKey: 'conversions', cell: (row) => row.conversions.toFixed(1) },
                      { header: 'Revenue', accessorKey: 'revenue', cell: (row) => `$${row.revenue.toFixed(2)}` },
                    ]}
                    keyExtractor={(row) => `${modelName}-${row.channel}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attribution Paths */}
      {data.attributionPaths && data.attributionPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Attribution Paths</CardTitle>
            <CardDescription>Most common multi-touch paths to conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.attributionPaths}
              columns={[
                { 
                  header: 'Path', 
                  accessorKey: 'path', 
                  cell: (row) => (
                    <div className="flex gap-1 flex-wrap">
                      {row.path.map((channel: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {channel}
                        </span>
                      ))}
                    </div>
                  )
                },
                { header: 'Conversions', accessorKey: 'conversionCount' },
                { header: 'Avg Touchpoints', accessorKey: 'avgTouchpoints', cell: (row) => row.avgTouchpoints.toFixed(1) },
              ]}
              keyExtractor={(row) => `path-${row.path.join('-')}`}
            />
          </CardContent>
        </Card>
      )}

      {/* Time to Conversion */}
      {data.timeToConversion && (
        <Card>
          <CardHeader>
            <CardTitle>Time to Conversion</CardTitle>
            <CardDescription>Time from first touch to conversion</CardDescription>
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

      {/* Touchpoint Frequency */}
      {data.touchpointFrequency && data.touchpointFrequency.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Touchpoint Frequency</CardTitle>
            <CardDescription>Distribution of touchpoints before conversion</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.touchpointFrequency}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="touchpointCount" label={{ value: 'Number of Touchpoints', position: 'insideBottom', offset: -5 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sessionCount" fill="#8884d8" name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

