'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import { toast } from '@/lib/toast';

interface ErrorDetail {
  id: number;
  fingerprint: string;
  type: string;
  message: string;
  stackTrace: Array<{
    filename?: string;
    function?: string;
    line?: number;
    column?: number;
    source?: string;
  }> | null;
  url: string;
  line: number | null;
  column: number | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  environment: string | null;
  release: string | null;
  breadcrumbs: Array<{
    type: string;
    message: string;
    data?: Record<string, any>;
    timestamp: number;
  }> | null;
  firstSeen: string;
  lastSeen: string;
  count: number;
  resolved: boolean;
  resolvedAt: string | null;
}

interface ErrorEvent {
  id: number;
  vid: string;
  sid: string;
  path: string;
  timestamp: string;
  userContext: Record<string, any> | null;
  breadcrumbs: Array<{
    type: string;
    message: string;
    data?: Record<string, any>;
    timestamp: number;
  }> | null;
}

export default function ErrorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const errorId = params.errorId as string;
  const [error, setError] = useState<ErrorDetail | null>(null);
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [frequency, setFrequency] = useState<Array<{ date: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchErrorDetails();
  }, [siteId, errorId]);

  const fetchErrorDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/app/api/sites/${siteId}/errors/${errorId}`);
      const data = await res.json();
      setError(data.error);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setFrequency(Array.isArray(data.frequency) ? data.frequency : []);
    } catch (error) {
      console.error('Error fetching error details:', error);
      toast.error('Failed to load error details');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (resolved: boolean) => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/errors/${errorId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      
      if (res.ok) {
        toast.success(resolved ? 'Error marked as resolved' : 'Error marked as unresolved');
        fetchErrorDetails();
      } else {
        throw new Error('Failed to update resolution status');
      }
    } catch (error) {
      toast.error('Failed to update resolution status');
    }
  };

  if (loading) {
    return <div className="p-8">Loading error details...</div>;
  }

  if (!error) {
    return <div className="p-8">Error not found</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline mb-2"
          >
            ← Back to Errors
          </button>
          <h1 className="text-2xl font-bold">Error Details</h1>
        </div>
        <button
          onClick={() => handleResolve(!error.resolved)}
          className={`px-4 py-2 rounded ${
            error.resolved
              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {error.resolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
        </button>
      </div>

      {/* Error Info */}
      <div className="bg-white p-6 rounded shadow space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Error Message</h2>
          <p className="font-mono text-sm bg-gray-100 p-3 rounded">{error.message}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Type</div>
            <div className="font-semibold">{error.type}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Count</div>
            <div className="font-semibold">{error.count.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">First Seen</div>
            <div className="font-semibold">{new Date(error.firstSeen).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Last Seen</div>
            <div className="font-semibold">{new Date(error.lastSeen).toLocaleString()}</div>
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">URL</div>
          <div className="font-mono text-sm break-all">{error.url}</div>
        </div>

        {error.line && (
          <div>
            <div className="text-sm text-gray-600 mb-1">Location</div>
            <div className="font-mono text-sm">
              Line {error.line}, Column {error.column || 'N/A'}
            </div>
          </div>
        )}

        {error.stackTrace && error.stackTrace.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-2">Stack Trace</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              {error.stackTrace.map((frame, idx) => (
                <div key={idx} className="mb-1">
                  {frame.function && <span className="text-blue-400">{frame.function}</span>}
                  {frame.filename && (
                    <span className="text-gray-400">
                      {' '}at {frame.filename}
                      {frame.line && `:${frame.line}`}
                      {frame.column && `:${frame.column}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error.breadcrumbs && error.breadcrumbs.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-2">Breadcrumbs</h3>
            <div className="space-y-2">
              {error.breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500">
                    {new Date(crumb.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    crumb.type === 'error' ? 'bg-red-100 text-red-800' :
                    crumb.type === 'network' ? 'bg-blue-100 text-blue-800' :
                    crumb.type === 'click' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {crumb.type}
                  </span>
                  <span>{crumb.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Frequency Chart */}
      {frequency.length > 0 && (
        <div>
            <h3 className="text-lg font-semibold mb-4">Error Frequency (Last 30 Days)</h3>
            <ChartContainer height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={frequency}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#8884d8" name="Occurrences" />
            </LineChart>
          </ResponsiveContainer>
                  </ChartContainer>
        </div>
      )}

      {/* Recent Events */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Occurrences</h2>
        <div className="bg-white rounded shadow overflow-hidden">
          <DataTable
            data={events}
            columns={[
              { key: 'timestamp', label: 'Time', sortable: true, render: (value) => new Date(value).toLocaleString() },
              { key: 'path', label: 'Path', sortable: true },
              { key: 'vid', label: 'Visitor ID', sortable: true },
            ]}
            keyExtractor={(row) => row.id.toString()}
            pagination={{ pageSize: 20 }}
          />
        </div>
      </div>
    </div>
  );
}


