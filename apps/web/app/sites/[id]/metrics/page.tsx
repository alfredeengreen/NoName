'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface CalculatedMetric {
  id: string;
  name: string;
  formula: string;
  description: string | null;
  enabled: boolean;
}

export default function MetricsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [metrics, setMetrics] = useState<CalculatedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    formula: '',
    description: '',
  });

  useEffect(() => {
    fetchMetrics();
  }, [siteId]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/metrics`);
      if (!res.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await res.json();
      setMetrics(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetrics([]);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', formula: '', description: '' });
        fetchMetrics();
      }
    } catch (error) {
      console.error('Error creating metric:', error);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/app/api/sites/${siteId}/metrics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchMetrics();
    } catch (error) {
      console.error('Error toggling metric:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading metrics...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calculated Metrics</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Metric'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-md p-2"
              placeholder="e.g., Revenue per Session"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Formula</label>
            <input
              type="text"
              value={formData.formula}
              onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
              className="w-full border rounded-md p-2 font-mono"
              placeholder="e.g., revenue / sessions"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported operators: +, -, *, /, %. Reference metrics by name (e.g., revenue, sessions, conversions)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-md p-2"
              rows={3}
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create Metric
          </button>
        </form>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Formula</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{metric.name}</td>
                <td className="px-4 py-3 font-mono text-sm">{metric.formula}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{metric.description || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${metric.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {metric.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(metric.id, metric.enabled)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {metric.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No calculated metrics defined. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-semibold mb-2">Example Formulas</h3>
        <div className="text-sm space-y-2 font-mono">
          <div>revenue / sessions</div>
          <div>conversions / visitors * 100</div>
          <div>(purchases / pageviews) * 100</div>
          <div>revenue - cost</div>
        </div>
      </div>
    </div>
  );
}

