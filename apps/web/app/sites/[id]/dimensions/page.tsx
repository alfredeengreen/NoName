'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CustomDimension {
  id: string;
  name: string;
  scope: 'user' | 'session' | 'event';
  dataType: 'string' | 'number' | 'boolean' | 'date';
  description: string | null;
  enabled: boolean;
}

export default function DimensionsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [dimensions, setDimensions] = useState<CustomDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    scope: 'event' as 'user' | 'session' | 'event',
    dataType: 'string' as 'string' | 'number' | 'boolean' | 'date',
    description: '',
  });

  useEffect(() => {
    fetchDimensions();
  }, [siteId]);

  const fetchDimensions = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/dimensions`);
      if (!res.ok) {
        throw new Error('Failed to fetch dimensions');
      }
      const data = await res.json();
      setDimensions(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dimensions:', error);
      setDimensions([]);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/dimensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', scope: 'event', dataType: 'string', description: '' });
        fetchDimensions();
      }
    } catch (error) {
      console.error('Error creating dimension:', error);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/app/api/sites/${siteId}/dimensions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchDimensions();
    } catch (error) {
      console.error('Error toggling dimension:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading dimensions...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Dimensions</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Dimension'}
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
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scope</label>
            <select
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })}
              className="w-full border rounded-md p-2"
            >
              <option value="user">User (persistent across sessions)</option>
              <option value="session">Session (per session only)</option>
              <option value="event">Event (per event only)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data Type</label>
            <select
              value={formData.dataType}
              onChange={(e) => setFormData({ ...formData, dataType: e.target.value as any })}
              className="w-full border rounded-md p-2"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
            </select>
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
            Create Dimension
          </button>
        </form>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Scope</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Data Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dim) => (
              <tr key={dim.id} className="border-t">
                <td className="px-4 py-3 font-mono text-sm">{dim.name}</td>
                <td className="px-4 py-3">{dim.scope}</td>
                <td className="px-4 py-3">{dim.dataType}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{dim.description || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${dim.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {dim.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(dim.id, dim.enabled)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {dim.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {dimensions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No custom dimensions defined. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-semibold mb-2">Usage Examples</h3>
        <div className="text-sm space-y-2 font-mono">
          <div>{/* User-scoped (persistent) */}</div>
          <div>aa.dimensions.setUser(&apos;user_type&apos;, &apos;premium&apos;);</div>
          <div className="mt-2">{/* Session-scoped */}</div>
          <div>aa.dimensions.setSession(&apos;experiment_group&apos;, &apos;variant_a&apos;);</div>
          <div className="mt-2">{/* Event-scoped (passed per event) */}</div>
          <div>aa.event(&apos;purchase&apos;, {'{'}price: 99.99{'}'}, {'{'}&apos;product_category&apos;: &apos;electronics&apos;{'}'});</div>
        </div>
      </div>
    </div>
  );
}

