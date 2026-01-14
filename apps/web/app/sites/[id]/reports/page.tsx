'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
  };
  delivery: Array<{ type: 'email' | 'webhook'; value: string }>;
  format: 'pdf' | 'csv' | 'json';
  enabled: boolean;
}

interface ImpactSummary {
  baseline: {
    sessions: number;
    conversions: number;
    conversionRate: number;
  };
  elements: number;
}

export default function ReportsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [impactSummary, setImpactSummary] = useState<ImpactSummary | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    reportType: string;
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      time: string;
    };
    delivery: Array<{ type: 'email' | 'webhook'; value: string }>;
    format: 'pdf' | 'csv' | 'json';
  }>({
    name: '',
    reportType: 'overview',
    schedule: {
      frequency: 'daily',
      dayOfWeek: 1,
      dayOfMonth: 1,
      time: '09:00',
    },
    delivery: [{ type: 'email', value: '' }],
    format: 'pdf',
  });

  useEffect(() => {
    fetchReports();
    fetchImpactSummary();
  }, [siteId]);

  const fetchImpactSummary = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/impact?minSessions=1&top=5`);
      if (res.ok) {
        const data = await res.json();
        setImpactSummary({
          baseline: data.baseline,
          elements: data.elements?.length || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching impact summary:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/reports`);
      if (!res.ok) {
        throw new Error('Failed to fetch reports');
      }
      const data = await res.json();
      // Ensure data is always an array
      setReports(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]); // Set to empty array on error
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          name: '',
          reportType: 'overview',
          schedule: { frequency: 'daily', dayOfWeek: 1, dayOfMonth: 1, time: '09:00' },
          delivery: [{ type: 'email', value: '' }],
          format: 'pdf',
        });
        fetchReports();
      }
    } catch (error) {
      console.error('Error creating report:', error);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/app/api/sites/${siteId}/reports`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchReports();
    } catch (error) {
      console.error('Error toggling report:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading scheduled reports...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <div className="flex gap-4 mt-2">
            <Link href={`/sites/${siteId}/reports/custom`} className="text-sm text-blue-600 hover:underline">
              Custom Reports
            </Link>
            <span className="text-sm text-muted-foreground">|</span>
            <span className="text-sm text-muted-foreground">Scheduled Reports</span>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Scheduled Report'}
        </button>
      </div>

      {/* Impact Analysis Summary */}
      {impactSummary && impactSummary.baseline.sessions > 0 && (
        <div className="bg-white rounded shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Impact Analysis</h2>
            <Link href={`/sites/${siteId}/impact`}>
              <button className="text-sm text-blue-600 hover:underline">
                View Full Report →
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Sampled Sessions</div>
              <div className="text-2xl font-bold">{impactSummary.baseline.sessions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Baseline Conversion Rate</div>
              <div className="text-2xl font-bold">
                {(impactSummary.baseline.conversionRate * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Elements Tracked</div>
              <div className="text-2xl font-bold">{impactSummary.elements}</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Impact analysis shows how different page elements affect conversion rates. 
            {impactSummary.elements > 0 && (
              <span> {impactSummary.elements} elements are currently being tracked.</span>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Report Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-md p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Report Type</label>
            <select
              value={formData.reportType}
              onChange={(e) => setFormData({ ...formData, reportType: e.target.value })}
              className="w-full border rounded-md p-2"
            >
              <option value="overview">Overview</option>
              <option value="audience">Audience</option>
              <option value="acquisition">Acquisition</option>
              <option value="behavior">Behavior</option>
              <option value="conversions">Conversions</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Frequency</label>
              <select
                value={formData.schedule.frequency}
                onChange={(e) => setFormData({ ...formData, schedule: { ...formData.schedule, frequency: e.target.value as any } })}
                className="w-full border rounded-md p-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time</label>
              <input
                type="time"
                value={formData.schedule.time}
                onChange={(e) => setFormData({ ...formData, schedule: { ...formData.schedule, time: e.target.value } })}
                className="w-full border rounded-md p-2"
                required
              />
            </div>
          </div>
          {formData.schedule.frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium mb-1">Day of Week</label>
              <select
                value={formData.schedule.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, schedule: { ...formData.schedule, dayOfWeek: parseInt(e.target.value) } })}
                className="w-full border rounded-md p-2"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          )}
          {formData.schedule.frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.schedule.dayOfMonth}
                onChange={(e) => setFormData({ ...formData, schedule: { ...formData.schedule, dayOfMonth: parseInt(e.target.value) || 1 } })}
                className="w-full border rounded-md p-2"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Format</label>
            <select
              value={formData.format}
              onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
              className="w-full border rounded-md p-2"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Delivery Channels</label>
            {formData.delivery.map((channel, i) => (
              <div key={i} className="flex items-center space-x-2 mb-2">
                <select
                  value={channel.type}
                  onChange={(e) => {
                    const newDelivery: Array<{ type: 'email' | 'webhook'; value: string }> = [...formData.delivery];
                    newDelivery[i] = { ...newDelivery[i], type: e.target.value as 'email' | 'webhook' };
                    setFormData({ ...formData, delivery: newDelivery });
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
                    const newDelivery = [...formData.delivery];
                    newDelivery[i] = { ...newDelivery[i], value: e.target.value };
                    setFormData({ ...formData, delivery: newDelivery });
                  }}
                  placeholder={channel.type === 'email' ? 'email@example.com' : 'https://webhook.url'}
                  className="flex-1 border rounded-md p-1"
                />
                {formData.delivery.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, delivery: formData.delivery.filter((_, idx) => idx !== i) })}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, delivery: [...formData.delivery, { type: 'email', value: '' }] })}
              className="mt-2 px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
            >
              + Add Channel
            </button>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create Report
          </button>
        </form>
      )}

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Schedule</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Format</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Delivery</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{report.name}</td>
                <td className="px-4 py-3 text-sm">{report.reportType}</td>
                <td className="px-4 py-3 text-sm">
                  {report.schedule.frequency} at {report.schedule.time}
                  {report.schedule.frequency === 'weekly' && ` (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][report.schedule.dayOfWeek || 0]})`}
                  {report.schedule.frequency === 'monthly' && ` (day ${report.schedule.dayOfMonth})`}
                </td>
                <td className="px-4 py-3 text-sm uppercase">{report.format}</td>
                <td className="px-4 py-3 text-sm">
                  {report.delivery.map((c, i) => (
                    <span key={i} className="mr-2">{c.type}: {c.value}</span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${report.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {report.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(report.id, report.enabled)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {report.enabled ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No scheduled reports. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

