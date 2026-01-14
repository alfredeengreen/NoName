'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';

interface FormData {
  forms: Array<{
    form_id: string;
    submissions: number;
    started: number;
    abandoned: number;
    completion_rate: number;
  }>;
  fields: Array<{
    form_id: string;
    field_name: string;
    avg_time_spent: number;
    total_errors: number;
    interactions: number;
  }>;
  dropoffs: Array<{
    form_id: string;
    field_name: string;
    abandon_count: number;
  }>;
}

export default function FormsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/forms?start=${start}&end=${end}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      setData({
        forms: Array.isArray(json.forms) ? json.forms : [],
        fields: Array.isArray(json.fields) ? json.fields : [],
        dropoffs: Array.isArray(json.dropoffs) ? json.dropoffs : [],
      });
    } catch (error) {
      console.error('Error fetching form data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading form analytics...</div>;
  }

  if (!data) {
    return <div className="p-8">Error loading form analytics</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Form Analytics</h1>

      {/* Form Completion Rates */}
      {data.forms.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Form Completion Rates</h2>
          <ChartContainer height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.forms}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="form_id" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completion_rate" fill="#8884d8" name="Completion Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-4 bg-white rounded shadow overflow-hidden">
            <DataTable
              data={data.forms}
              columns={[
                { key: 'form_id', label: 'Form ID', sortable: true },
                { key: 'started', label: 'Started', sortable: true },
                { key: 'submissions', label: 'Submissions', sortable: true },
                { key: 'abandoned', label: 'Abandoned', sortable: true },
                { key: 'completion_rate', label: 'Completion Rate (%)', sortable: true, render: (value) => `${Number(value || 0).toFixed(1)}%` },
              ]}
              keyExtractor={(row) => row.form_id}
            />
          </div>
        </div>
      )}

      {/* Field-Level Analytics */}
      {data.fields.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Field-Level Analytics</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <DataTable
              data={data.fields}
              columns={[
                { key: 'form_id', label: 'Form ID', sortable: true },
                { key: 'field_name', label: 'Field', sortable: true },
                { key: 'avg_time_spent', label: 'Avg Time (s)', sortable: true },
                { key: 'total_errors', label: 'Total Errors', sortable: true },
                { key: 'interactions', label: 'Interactions', sortable: true },
              ]}
              keyExtractor={(row) => `${row.form_id}_${row.field_name}`}
              pagination={{ pageSize: 20 }}
            />
          </div>
        </div>
      )}

      {/* Drop-off Points */}
      {data.dropoffs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Top Drop-off Points</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <DataTable
              data={data.dropoffs}
              columns={[
                { key: 'form_id', label: 'Form ID', sortable: true },
                { key: 'field_name', label: 'Field', sortable: true },
                { key: 'abandon_count', label: 'Abandon Count', sortable: true },
              ]}
              keyExtractor={(row) => `${row.form_id}_${row.field_name}`}
            />
          </div>
        </div>
      )}

      {data.forms.length === 0 && data.fields.length === 0 && (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          No form analytics data available.
        </div>
      )}
    </div>
  );
}

