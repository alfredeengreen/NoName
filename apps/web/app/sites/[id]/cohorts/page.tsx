'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';

interface CohortData {
  cohortDate: string;
  data: Array<{ daysSinceAcquisition?: number; daysSinceEvent?: number; sessions: number; visitors: number }>;
}

interface CohortAnalysis {
  type: 'acquisition' | 'event';
  eventName?: string;
  cohorts: CohortData[];
}

export default function CohortsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<CohortAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [cohortType, setCohortType] = useState<'acquisition' | 'event'>('acquisition');
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    fetchCohorts();
  }, [siteId, cohortType, eventName]);

  const fetchCohorts = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      let url = `/api/sites/${siteId}/cohorts?type=${cohortType}&start=${start}&end=${end}`;
      if (cohortType === 'event' && eventName) {
        url += `&event=${encodeURIComponent(eventName)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      setData(null);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading cohort analysis...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading cohort data</div>;
  }

  // Transform data for retention matrix visualization
  const retentionMatrix = data.cohorts.map((cohort) => {
    const maxDays = Math.max(...cohort.data.map((d) => (d.daysSinceAcquisition || d.daysSinceEvent || 0)));
    const retention: Record<number, number> = {};
    
    // Calculate retention rate for each day
    const day0Visitors = cohort.data.find((d) => (d.daysSinceAcquisition || d.daysSinceEvent || 0) === 0)?.visitors || 0;
    
    cohort.data.forEach((d) => {
      const days = d.daysSinceAcquisition || d.daysSinceEvent || 0;
      retention[days] = day0Visitors > 0 ? (d.visitors / day0Visitors) * 100 : 0;
    });

    return {
      cohortDate: cohort.cohortDate,
      retention,
      maxDays,
    };
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cohort Analysis</h1>
        <div className="flex items-center space-x-4">
          <select
            value={cohortType}
            onChange={(e) => setCohortType(e.target.value as 'acquisition' | 'event')}
            className="border rounded-md p-2"
          >
            <option value="acquisition">Acquisition Date</option>
            <option value="event">Event-Based</option>
          </select>
          {cohortType === 'event' && (
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Event name (e.g., purchase)"
              className="border rounded-md p-2"
            />
          )}
          <button
            onClick={fetchCohorts}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {data.cohorts.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No cohort data available for the selected period.
        </div>
      ) : (
        <>
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Retention Matrix</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left border-b">Cohort</th>
                    {Array.from({ length: Math.min(30, Math.max(...retentionMatrix.map((r) => r.maxDays)) + 1) }, (_, i) => (
                      <th key={i} className="px-2 py-2 text-center border-b">
                        D{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retentionMatrix.slice(0, 20).map((row) => (
                    <tr key={row.cohortDate}>
                      <td className="px-2 py-2 border-b font-mono text-xs">{row.cohortDate}</td>
                      {Array.from({ length: Math.min(30, row.maxDays + 1) }, (_, i) => {
                        const retention = row.retention[i] || 0;
                        const intensity = Math.min(100, retention);
                        return (
                          <td
                            key={i}
                            className="px-2 py-2 text-center border-b"
                            style={{
                              backgroundColor: `rgba(59, 130, 246, ${intensity / 100})`,
                              color: intensity > 50 ? 'white' : 'black',
                            }}
                          >
                            {retention > 0 ? `${retention.toFixed(0)}%` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Cohort Retention Over Time</h3>
            <ChartContainer height={400}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.cohorts.slice(0, 10).flatMap((cohort) =>
                cohort.data.map((d) => ({
                  cohort: cohort.cohortDate,
                  days: d.daysSinceAcquisition || d.daysSinceEvent || 0,
                  visitors: d.visitors,
                  sessions: d.sessions,
                }))
              )}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="days" label={{ value: 'Days Since Acquisition', position: 'insideBottom', offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visitors" stroke="#8884d8" name="Visitors" />
              </LineChart>
            </ResponsiveContainer>
                    </ChartContainer>
        </div>
        </>
      )}
    </div>
  );
}

