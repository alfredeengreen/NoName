'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';

interface MCFChannel {
  channel: string;
  interactions: number;
  firstTouch: number;
  lastTouch: number;
  assisted: number;
  totalConversions: number;
}

interface MCFData {
  channels: MCFChannel[];
  pathAnalysis?: Array<{ path: string[]; conversionCount: number; avgPathLength: number }>;
  interactionMatrix?: Array<{ channel1: string; channel2: string; interactionCount: number }>;
}

export default function MCFPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<MCFData>({ channels: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMCF();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchMCF = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/mcf?start=${start}&end=${end}`);
      if (!res.ok) {
        throw new Error('Failed to fetch MCF data');
      }
      const json = await res.json();
      setData({
        channels: Array.isArray(json.channels) ? json.channels : [],
        pathAnalysis: Array.isArray(json.pathAnalysis) ? json.pathAnalysis : [],
        interactionMatrix: Array.isArray(json.interactionMatrix) ? json.interactionMatrix : [],
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching MCF:', error);
      setData({ channels: [] });
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading multi-channel funnel data...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Multi-Channel Funnel</h1>

      <div className="bg-blue-50 p-4 rounded">
        <p className="text-sm">
          Multi-channel funnel analysis shows how different channels work together to drive conversions.
          <strong>First Touch:</strong> Channel that first brought the user. <strong>Last Touch:</strong> Channel that closed the conversion. <strong>Assisted:</strong> Channels that helped but weren&apos;t first or last.
        </p>
      </div>

      <div>
            <h3 className="text-lg font-semibold mb-4">Channel Attribution</h3>
            <ChartContainer height={400}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.channels}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="firstTouch" fill="#8884d8" name="First Touch" stackId="a" />
            <Bar dataKey="assisted" fill="#82ca9d" name="Assisted" stackId="a" />
            <Bar dataKey="lastTouch" fill="#ffc658" name="Last Touch" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
                </ChartContainer>
        </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Channel Performance</h2>
        <DataTable
          data={data.channels}
          columns={[
            { header: 'Channel', accessorKey: 'channel' },
            { header: 'Interactions', accessorKey: 'interactions' },
            { header: 'First Touch', accessorKey: 'firstTouch' },
            { header: 'Assisted', accessorKey: 'assisted' },
            { header: 'Last Touch', accessorKey: 'lastTouch' },
            { header: 'Total Conversions', accessorKey: 'totalConversions' },
          ]}
        />
      </div>

      {data.pathAnalysis && data.pathAnalysis.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Top Conversion Paths</h2>
          <DataTable
            data={data.pathAnalysis.slice(0, 10)}
            columns={[
              { 
                header: 'Path', 
                accessorKey: 'path', 
                cell: (row: any) => (
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
              { header: 'Avg Path Length', accessorKey: 'avgPathLength', cell: (row: any) => row.avgPathLength.toFixed(1) },
            ]}
          />
        </div>
      )}

      {data.interactionMatrix && data.interactionMatrix.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Channel Interaction Matrix</h2>
          <DataTable
            data={data.interactionMatrix}
            columns={[
              { header: 'Channel 1', accessorKey: 'channel1' },
              { header: 'Channel 2', accessorKey: 'channel2' },
              { header: 'Interactions', accessorKey: 'interactionCount' },
            ]}
          />
        </div>
      )}
    </div>
  );
}

