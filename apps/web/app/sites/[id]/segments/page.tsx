'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SegmentCondition {
  dimension: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | boolean | string[];
  logic?: 'AND' | 'OR';
}

interface Segment {
  id: string;
  name: string;
  conditions: SegmentCondition[];
  description: string | null;
  enabled: boolean;
}

export default function SegmentsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    conditions: [{ dimension: 'path', operator: 'equals' as const, value: '' }] as SegmentCondition[],
  });

  useEffect(() => {
    fetchSegments();
  }, [siteId]);

  const fetchSegments = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/segments`);
      if (!res.ok) {
        throw new Error('Failed to fetch segments');
      }
      const data = await res.json();
      // Ensure data is always an array
      setSegments(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching segments:', error);
      setSegments([]); // Set to empty array on error
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', description: '', conditions: [{ dimension: 'path', operator: 'equals', value: '' }] });
        fetchSegments();
      }
    } catch (error) {
      console.error('Error creating segment:', error);
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { dimension: 'path', operator: 'equals', value: '' }],
    });
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index: number, field: keyof SegmentCondition, value: any) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setFormData({ ...formData, conditions: newConditions });
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/app/api/sites/${siteId}/segments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchSegments();
    } catch (error) {
      console.error('Error toggling segment:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading segments...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Segments</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Segment'}
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
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-md p-2"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Conditions</label>
            {formData.conditions.map((condition, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2 p-3 bg-gray-50 rounded">
                {index > 0 && (
                  <select
                    value={condition.logic || 'AND'}
                    onChange={(e) => updateCondition(index, 'logic', e.target.value)}
                    className="border rounded-md p-1 text-sm"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                <select
                  value={condition.dimension}
                  onChange={(e) => updateCondition(index, 'dimension', e.target.value)}
                  className="border rounded-md p-1 text-sm"
                >
                  <option value="path">Path</option>
                  <option value="country">Country</option>
                  <option value="device_category">Device</option>
                  <option value="os">OS</option>
                  <option value="utm_source">UTM Source</option>
                  <option value="utm_campaign">UTM Campaign</option>
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  className="border rounded-md p-1 text-sm"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="greater_than">greater than</option>
                  <option value="less_than">less than</option>
                  <option value="in">in</option>
                  <option value="not_in">not in</option>
                </select>
                <input
                  type="text"
                  value={typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value)}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  className="flex-1 border rounded-md p-1 text-sm"
                  placeholder="Value"
                />
                {formData.conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addCondition}
              className="mt-2 px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
            >
              + Add Condition
            </button>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create Segment
          </button>
        </form>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Conditions</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{segment.name}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="space-y-1">
                    {segment.conditions.map((cond, i) => (
                      <div key={i} className="font-mono text-xs">
                        {i > 0 && <span className="text-gray-400">{cond.logic || 'AND'} </span>}
                        {cond.dimension} {cond.operator} {typeof cond.value === 'string' ? cond.value : JSON.stringify(cond.value)}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${segment.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {segment.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(segment.id, segment.enabled)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {segment.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {segments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No segments defined. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

