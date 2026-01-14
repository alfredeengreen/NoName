'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface VerifyData {
  last_event_ts: number | null;
  stats: {
    accepted: number;
    dropped_invalid: number;
    dropped_pii: number;
    dropped_rate_limited: number;
    dropped_cardinality: number;
  };
  recent_events: Array<{
    type: string;
    name?: string;
    path: string;
    ts: number;
  }>;
}

export default function VerifyPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/app/api/sites/${siteId}/verify`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading verification data</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Install Verification</h1>
      <div className="space-y-6">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="font-semibold mb-4">Status</h2>
          {data.last_event_ts ? (
            <div className="text-green-600">
              ✓ Last event received: {new Date(data.last_event_ts * 1000).toLocaleString()}
            </div>
          ) : (
            <div className="text-yellow-600">⚠ No events received yet</div>
          )}
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h2 className="font-semibold mb-4">Stats (Last 10 minutes)</h2>
          <div className="space-y-2">
            <div>Accepted: {data.stats.accepted}</div>
            <div>Dropped (invalid): {data.stats.dropped_invalid}</div>
            <div>Dropped (PII): {data.stats.dropped_pii}</div>
            <div>Dropped (rate limited): {data.stats.dropped_rate_limited}</div>
            <div>Dropped (cardinality): {data.stats.dropped_cardinality}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h2 className="font-semibold mb-4">Recent Events</h2>
          <div className="space-y-2">
            {data.recent_events.map((event, i) => (
              <div key={i} className="text-sm border-b pb-2">
                <div className="font-mono">
                  {event.type} {event.name && `- ${event.name}`}
                </div>
                <div className="text-gray-600">{event.path}</div>
                <div className="text-gray-500 text-xs">
                  {new Date(event.ts * 1000).toLocaleString()}
                </div>
              </div>
            ))}
            {data.recent_events.length === 0 && (
              <div className="text-gray-500">No recent events</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


