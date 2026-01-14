'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AlertCondition {
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  timeWindow: number;
}

interface Alert {
  id: string;
  name: string;
  condition: AlertCondition;
  notificationChannels: Array<{ type: 'email' | 'webhook'; value: string }>;
  enabled: boolean;
}

export default function AlertsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    condition: AlertCondition;
    notificationChannels: Array<{ type: 'email' | 'webhook'; value: string }>;
  }>({
    name: '',
    condition: {
      metric: 'pageviews',
      operator: 'less_than',
      threshold: 100,
      timeWindow: 60,
    },
    notificationChannels: [{ type: 'email', value: '' }],
  });

  useEffect(() => {
    fetchAlerts();
  }, [siteId]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/alerts`);
      if (!res.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          name: '',
          condition: { metric: 'pageviews', operator: 'less_than', threshold: 100, timeWindow: 60 },
          notificationChannels: [{ type: 'email', value: '' }],
        });
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/app/api/sites/${siteId}/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchAlerts();
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading alerts...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Alert'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Alert Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-md p-2"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Metric</label>
              <select
                value={formData.condition.metric}
                onChange={(e) => setFormData({ ...formData, condition: { ...formData.condition, metric: e.target.value } })}
                className="w-full border rounded-md p-2"
              >
                <option value="pageviews">Pageviews</option>
                <option value="sessions">Sessions</option>
                <option value="conversions">Conversions</option>
                <option value="bounce_rate">Bounce Rate</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Operator</label>
              <select
                value={formData.condition.operator}
                onChange={(e) => setFormData({ ...formData, condition: { ...formData.condition, operator: e.target.value as any } })}
                className="w-full border rounded-md p-2"
              >
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Threshold</label>
              <input
                type="number"
                value={formData.condition.threshold}
                onChange={(e) => setFormData({ ...formData, condition: { ...formData.condition, threshold: parseFloat(e.target.value) || 0 } })}
                className="w-full border rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time Window (minutes)</label>
              <input
                type="number"
                value={formData.condition.timeWindow}
                onChange={(e) => setFormData({ ...formData, condition: { ...formData.condition, timeWindow: parseInt(e.target.value) || 60 } })}
                className="w-full border rounded-md p-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notification Channels</label>
            {formData.notificationChannels.map((channel, i) => (
              <div key={i} className="flex items-center space-x-2 mb-2">
                <select
                  value={channel.type}
                  onChange={(e) => {
                    const newChannels: Array<{ type: 'email' | 'webhook'; value: string }> = [...formData.notificationChannels];
                    newChannels[i] = { ...newChannels[i], type: e.target.value as 'email' | 'webhook' };
                    setFormData({ ...formData, notificationChannels: newChannels });
                  }}
                  className="border rounded-md p-1"
                >
                  <option value="email">Email</option>
                  <option value="webhook">Webhook</option>
                </select>
                <input
                  type="text"
                  value={channel.value}
                  onChange={(e) => {
                    const newChannels = [...formData.notificationChannels];
                    newChannels[i] = { ...newChannels[i], value: e.target.value };
                    setFormData({ ...formData, notificationChannels: newChannels });
                  }}
                  placeholder={channel.type === 'email' ? 'email@example.com' : 'https://webhook.url'}
                  className="flex-1 border rounded-md p-1"
                />
                {formData.notificationChannels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, notificationChannels: formData.notificationChannels.filter((_, idx) => idx !== i) })}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, notificationChannels: [...formData.notificationChannels, { type: 'email', value: '' }] })}
              className="mt-2 px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
            >
              + Add Channel
            </button>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create Alert
          </button>
        </form>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Condition</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Channels</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{alert.name}</td>
                <td className="px-4 py-3 text-sm">
                  {alert.condition.metric} {alert.condition.operator} {alert.condition.threshold} (last {alert.condition.timeWindow} min)
                </td>
                <td className="px-4 py-3 text-sm">
                  {alert.notificationChannels.map((c, i) => (
                    <span key={i} className="mr-2">{c.type}: {c.value}</span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${alert.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {alert.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(alert.id, alert.enabled)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {alert.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No alerts defined. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

