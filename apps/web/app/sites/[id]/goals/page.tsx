'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import MetricCard from '@/components/MetricCard';

interface Goal {
  id: string;
  name: string;
  type: 'destination' | 'event' | 'duration' | 'pages';
  config: {
    destination?: string;
    eventName?: string;
    durationSeconds?: number;
    pagesPerSession?: number;
    value?: number;
  };
  description: string | null;
  enabled: boolean;
}

interface GoalConversion {
  date: string;
  conversions: number;
  uniqueVisitors: number;
}

export default function GoalsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [conversions, setConversions] = useState<GoalConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'destination' as 'destination' | 'event' | 'duration' | 'pages',
    config: {} as Goal['config'],
    description: '',
  });

  useEffect(() => {
    fetchGoals();
  }, [siteId]);

  useEffect(() => {
    if (selectedGoal) {
      fetchConversions(selectedGoal);
    }
  }, [selectedGoal, siteId]);

  const fetchGoals = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/goals`);
      if (!res.ok) {
        throw new Error('Failed to fetch goals');
      }
      const data = await res.json();
      const goalsArray = Array.isArray(data) ? data : [];
      setGoals(goalsArray);
      setLoading(false);
      if (goalsArray.length > 0 && !selectedGoal) {
        setSelectedGoal(goalsArray[0].id);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
      setLoading(false);
    }
  };

  const fetchConversions = async (goalId: string) => {
    try {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date().toISOString();
      const res = await fetch(`/app/api/sites/${siteId}/goals/${goalId}/conversions?start=${start}&end=${end}`);
      if (!res.ok) {
        throw new Error('Failed to fetch conversions');
      }
      const data = await res.json();
      // Ensure data is always an array
      setConversions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching conversions:', error);
      setConversions([]); // Set empty array on error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', type: 'destination', config: {}, description: '' });
        fetchGoals();
      }
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  const totalConversions = conversions.reduce((sum, c) => sum + c.conversions, 0);
  const totalVisitors = conversions.reduce((sum, c) => sum + c.uniqueVisitors, 0);

  if (loading) {
    return <div className="p-8">Loading goals...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Goals</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Create Goal'}
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
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any, config: {} })}
              className="w-full border rounded-md p-2"
            >
              <option value="destination">Destination (Page)</option>
              <option value="event">Event</option>
              <option value="duration">Duration</option>
              <option value="pages">Pages per Session</option>
            </select>
          </div>
          {formData.type === 'destination' && (
            <div>
              <label className="block text-sm font-medium mb-1">Destination Path</label>
              <input
                type="text"
                value={formData.config.destination || ''}
                onChange={(e) => setFormData({ ...formData, config: { ...formData.config, destination: e.target.value } })}
                className="w-full border rounded-md p-2"
                placeholder="/thank-you"
              />
            </div>
          )}
          {formData.type === 'event' && (
            <div>
              <label className="block text-sm font-medium mb-1">Event Name</label>
              <input
                type="text"
                value={formData.config.eventName || ''}
                onChange={(e) => setFormData({ ...formData, config: { ...formData.config, eventName: e.target.value } })}
                className="w-full border rounded-md p-2"
                placeholder="purchase"
              />
            </div>
          )}
          {formData.type === 'duration' && (
            <div>
              <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
              <input
                type="number"
                value={formData.config.durationSeconds || ''}
                onChange={(e) => setFormData({ ...formData, config: { ...formData.config, durationSeconds: parseInt(e.target.value) || 0 } })}
                className="w-full border rounded-md p-2"
                placeholder="300"
              />
            </div>
          )}
          {formData.type === 'pages' && (
            <div>
              <label className="block text-sm font-medium mb-1">Pages per Session</label>
              <input
                type="number"
                value={formData.config.pagesPerSession || ''}
                onChange={(e) => setFormData({ ...formData, config: { ...formData.config, pagesPerSession: parseInt(e.target.value) || 0 } })}
                className="w-full border rounded-md p-2"
                placeholder="5"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-md p-2"
              rows={2}
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create Goal
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Goals</h2>
          <div className="space-y-2">
            {goals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal.id)}
                className={`w-full text-left p-3 rounded ${
                  selectedGoal === goal.id ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="font-semibold">{goal.name}</div>
                <div className="text-sm text-gray-600">{goal.type}</div>
              </button>
            ))}
            {goals.length === 0 && (
              <p className="text-gray-500 text-sm">No goals defined. Create one to get started.</p>
            )}
          </div>
        </div>

        {selectedGoal && (
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Goal Performance</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <MetricCard
                title="Total Conversions"
                value={totalConversions}
                className="p-3"
              />
              <MetricCard
                title="Unique Visitors"
                value={totalVisitors}
                className="p-3"
              />
            </div>
            {conversions.length > 0 && (
              <ChartContainer height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={conversions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="conversions" stroke="#8884d8" name="Conversions" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

