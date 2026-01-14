'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';

interface Error {
  id: number;
  fingerprint: string;
  type: string;
  message: string;
  url: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
  resolved: boolean;
  resolvedAt: string | null;
  environment: string | null;
  release: string | null;
  eventCount: number;
  affectedUsers: number;
}

export default function ErrorsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [errors, setErrors] = useState<Error[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || '',
    environment: searchParams.get('environment') || '',
    resolved: searchParams.get('resolved') || '',
    search: searchParams.get('search') || '',
  });

  useEffect(() => {
    fetchErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end'), searchParams.get('search')]);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const queryParams = new URLSearchParams({
        start,
        end,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      });
      
      const res = await fetch(`/app/api/sites/${siteId}/errors?${queryParams}`);
      const data = await res.json();
      setErrors(Array.isArray(data.errors) ? data.errors : []);
    } catch (error) {
      console.error('Error fetching errors:', error);
      setErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    const queryParams = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) queryParams.set(k, v);
    });
    router.push(`/sites/${siteId}/errors?${queryParams}`);
  };

  if (loading) {
    return <div className="p-8">Loading errors...</div>;
  }

  const unresolvedCount = errors.filter(e => !e.resolved).length;
  const totalCount = errors.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Error Tracking</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Total Errors</div>
          <div className="text-2xl font-bold">{errors.length}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Unresolved</div>
          <div className="text-2xl font-bold text-red-600">{unresolvedCount}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-600 mb-1">Total Occurrences</div>
          <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option value="">All Types</option>
              <option value="js">JavaScript</option>
              <option value="network">Network</option>
              <option value="resource">Resource</option>
              <option value="promise">Promise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
            <input
              type="text"
              value={filters.environment}
              onChange={(e) => handleFilterChange('environment', e.target.value)}
              placeholder="production, staging..."
              className="w-full border rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.resolved}
              onChange={(e) => handleFilterChange('resolved', e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option value="">All</option>
              <option value="false">Unresolved</option>
              <option value="true">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search message or fingerprint..."
              className="w-full border rounded-md p-2"
            />
          </div>
        </div>
      </div>

      {/* Errors Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <DataTable
          data={errors}
          columns={[
            { key: 'message', label: 'Message', sortable: true },
            { key: 'type', label: 'Type', sortable: true },
            { key: 'count', label: 'Count', sortable: true },
            { key: 'affectedUsers', label: 'Users', sortable: true },
            { key: 'lastSeen', label: 'Last Seen', sortable: true, render: (value) => new Date(value).toLocaleString() },
            { key: 'resolved', label: 'Status', sortable: true, render: (value) => value ? 'Resolved' : 'Unresolved' },
          ]}
          keyExtractor={(row) => row.id.toString()}
          onRowClick={(row) => router.push(`/sites/${siteId}/errors/${row.id}`)}
          pagination={{ pageSize: 20 }}
        />
      </div>
    </div>
  );
}

