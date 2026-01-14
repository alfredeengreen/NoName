'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import DataTable from '@/components/DataTable';

interface Recording {
  id: string;
  vid: string;
  sid: string;
  path: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  metadata: {
    device?: Record<string, any>;
    viewport?: { width: number; height: number };
    url?: string;
  } | null;
}

export default function RecordingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/recordings?start=${start}&end=${end}`);
      const data = await res.json();
      setRecordings(Array.isArray(data.recordings) ? data.recordings : []);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading recordings...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Session Recordings</h1>

      <div className="bg-white rounded shadow overflow-hidden">
        <DataTable
          data={recordings}
          columns={[
            { key: 'path', label: 'Path', sortable: true },
            { key: 'startTime', label: 'Start Time', sortable: true, render: (value) => new Date(value).toLocaleString() },
            { key: 'duration', label: 'Duration (s)', sortable: true, render: (value) => value ? `${value}s` : '-' },
            { key: 'vid', label: 'Visitor ID', sortable: true },
          ]}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/sites/${siteId}/recordings/${row.id}`)}
          pagination={{ pageSize: 20 }}
        />
      </div>

      {recordings.length === 0 && (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          No session recordings available.
        </div>
      )}
    </div>
  );
}

