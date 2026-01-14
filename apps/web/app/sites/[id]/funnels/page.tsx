'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import MetricCard from '@/components/MetricCard';
import Link from 'next/link';
import { TrendingDown, Lightbulb, ExternalLink } from 'lucide-react';

interface FunnelStep {
  step: number;
  name: string;
  count: number;
  rate: number;
  dropOff: number;
  elementContributions?: {
    topPositive: Array<{
      elementId: string;
      label?: string;
      role?: string;
      sessionsAtStep: number;
      sessionsAtNextStep: number;
      progressionRate: number;
      lift: number;
    }>;
    topNegative: Array<{
      elementId: string;
      label?: string;
      role?: string;
      sessionsAtStep: number;
      sessionsAtNextStep: number;
      progressionRate: number;
      lift: number;
    }>;
  };
}

interface SavedFunnel {
  id: string;
  name: string;
  steps: Array<{ type: 'page' | 'event'; value: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
}

interface FunnelStepEvent {
  sid: string;
  vid: string;
  events: Array<{
    eventName: string | null;
    eventType: string;
    path: string;
    timestamp: Date;
    props?: Record<string, any>;
  }>;
}

export default function FunnelsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [funnelData, setFunnelData] = useState<{ steps: FunnelStep[]; stepEvents?: FunnelStepEvent[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedFunnels, setSavedFunnels] = useState<SavedFunnel[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saveFunnelName, setSaveFunnelName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [steps, setSteps] = useState<Array<{ type: 'page' | 'event'; value: string; name: string }>>([
    { type: 'page', value: '', name: '' },
  ]);

  // Load saved funnels
  useEffect(() => {
    loadSavedFunnels();
  }, [siteId]);

  const loadSavedFunnels = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/funnels/saved`);
      if (res.ok) {
        const data = await res.json();
        setSavedFunnels(data);
      }
    } catch (error) {
      console.error('Error loading saved funnels:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const loadSavedFunnel = (funnel: SavedFunnel) => {
    setSteps(funnel.steps.map(s => ({ ...s, name: s.name || s.value })));
    setShowSaveDialog(false);
  };

  const deleteSavedFunnel = async (funnelId: string) => {
    if (!confirm('Are you sure you want to delete this saved funnel?')) return;
    
    try {
      const res = await fetch(`/app/api/sites/${siteId}/funnels/saved/${funnelId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadSavedFunnels();
      }
    } catch (error) {
      console.error('Error deleting saved funnel:', error);
    }
  };

  const saveFunnel = async () => {
    if (!saveFunnelName.trim()) {
      alert('Please enter a name for the funnel');
      return;
    }

    try {
      const res = await fetch(`/app/api/sites/${siteId}/funnels/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveFunnelName,
          steps: steps.map((s) => ({ type: s.type, value: s.value, name: s.name || s.value })),
        }),
      });

      if (res.ok) {
        setShowSaveDialog(false);
        setSaveFunnelName('');
        loadSavedFunnels();
        alert('Funnel saved successfully!');
      } else {
        alert('Failed to save funnel');
      }
    } catch (error) {
      console.error('Error saving funnel:', error);
      alert('Error saving funnel');
    }
  };

  const addStep = () => {
    setSteps([...steps, { type: 'page', value: '', name: '' }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: 'type' | 'value' | 'name', value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const runFunnel = async () => {
    if (steps.some((s) => !s.value)) {
      alert('Please fill in all step values');
      return;
    }

    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();

      const res = await fetch(`/app/api/sites/${siteId}/funnels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: steps.map((s) => ({ type: s.type, value: s.value, name: s.name || s.value })),
          start,
          end,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to run funnel analysis');
      }
      const data = await res.json();
      console.log('Funnel data received:', data);
      console.log('Steps with element contributions:', data.steps?.map((s: any) => ({
        step: s.step,
        name: s.name,
        hasContributions: !!s.elementContributions,
        topPositive: s.elementContributions?.topPositive?.length || 0,
        topNegative: s.elementContributions?.topNegative?.length || 0,
      })));
      // Ensure steps is always an array
      setFunnelData({
        ...data,
        steps: Array.isArray(data.steps) ? data.steps : [],
        stepEvents: Array.isArray(data.stepEvents) ? data.stepEvents : [],
      });
      setLoading(false);
    } catch (error) {
      console.error('Error running funnel:', error);
      setFunnelData(null);
      setLoading(false);
    }
  };

  const totalDropOff = funnelData?.steps.reduce((sum, s) => sum + s.dropOff, 0) || 0;
  const conversionRate = funnelData?.steps.length 
    ? (funnelData.steps[funnelData.steps.length - 1].rate || 0)
    : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funnel Builder</h1>
          <p className="text-sm text-gray-600 mt-1">
            Analyze conversion funnels with element-level impact analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/sites/${siteId}/impact`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
          >
            <TrendingDown className="h-4 w-4" />
            Impact Dashboard
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href={`/sites/${siteId}/insights`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
          >
            <Lightbulb className="h-4 w-4" />
            Insights
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={!funnelData || loading}
          >
            Save to Favorites
          </button>
        </div>
      </div>

      {/* Saved Funnels */}
      {savedFunnels.length > 0 && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Saved Funnels</h2>
          <div className="flex flex-wrap gap-2">
            {savedFunnels.map((funnel) => (
              <div key={funnel.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                <button
                  onClick={() => loadSavedFunnel(funnel)}
                  className="text-blue-600 hover:underline"
                >
                  {funnel.name}
                </button>
                <button
                  onClick={() => deleteSavedFunnel(funnel.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Funnel to Favorites</h3>
            <input
              type="text"
              value={saveFunnelName}
              onChange={(e) => setSaveFunnelName(e.target.value)}
              placeholder="Enter funnel name"
              className="w-full border rounded-md p-2 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && saveFunnel()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveFunnel}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded shadow space-y-4">
        <h2 className="text-lg font-semibold">Define Funnel Steps</h2>
        {steps.map((step, index) => (
          <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
            <span className="font-semibold">Step {index + 1}:</span>
            <select
              value={step.type}
              onChange={(e) => updateStep(index, 'type', e.target.value)}
              className="border rounded-md p-1"
            >
              <option value="page">Page</option>
              <option value="event">Event</option>
            </select>
            <input
              type="text"
              value={step.value}
              onChange={(e) => updateStep(index, 'value', e.target.value)}
              placeholder={step.type === 'page' ? '/page-path' : 'event_name'}
              className="flex-1 border rounded-md p-1"
            />
            <input
              type="text"
              value={step.name}
              onChange={(e) => updateStep(index, 'name', e.target.value)}
              placeholder="Display name (optional)"
              className="flex-1 border rounded-md p-1"
            />
            {steps.length > 1 && (
              <button
                onClick={() => removeStep(index)}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="flex space-x-2">
          <button
            onClick={addStep}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            + Add Step
          </button>
          <button
            onClick={runFunnel}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Running...' : 'Run Funnel Analysis'}
          </button>
        </div>
      </div>

      {funnelData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="Conversion Rate"
              value={`${conversionRate.toFixed(1)}%`}
            />
            <MetricCard
              title="Total Drop-off"
              value={`${totalDropOff.toFixed(1)}%`}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Funnel Visualization</h3>
            <ChartContainer height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.isArray(funnelData.steps) ? funnelData.steps : []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Users" />
                  <Bar dataKey="rate" fill="#82ca9d" name="Conversion Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Funnel Steps</h2>
            <DataTable
              data={funnelData.steps}
              columns={[
                { key: 'step', label: 'Step', sortable: true },
                { key: 'name', label: 'Name', sortable: true },
                { key: 'count', label: 'Users', sortable: true, render: (value) => value.toLocaleString() },
                { key: 'rate', label: 'Conversion Rate', sortable: true, render: (value) => `${Number(value).toFixed(1)}%` },
                { key: 'dropOff', label: 'Drop-off', sortable: true, render: (value) => `${Number(value).toFixed(1)}%` },
                {
                  key: 'elementImpact',
                  label: 'Element Impact',
                  render: (value, row: FunnelStep) => {
                    const contributions = row.elementContributions;
                    if (!contributions || (!contributions.topPositive.length && !contributions.topNegative.length)) {
                      return <span className="text-gray-400 text-sm">No data</span>;
                    }
                    return (
                      <div className="flex gap-2">
                        {contributions.topPositive.length > 0 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            +{contributions.topPositive.length}
                          </span>
                        )}
                        {contributions.topNegative.length > 0 && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            -{contributions.topNegative.length}
                          </span>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: 'events',
                  label: 'Events',
                  render: (value, row) => (
                    <button
                      onClick={() => setExpandedStep(expandedStep === row.step - 1 ? null : row.step - 1)}
                      className="text-blue-600 hover:underline"
                    >
                      {expandedStep === row.step - 1 ? 'Hide' : 'Show'} Events
                    </button>
                  ),
                },
              ]}
              keyExtractor={(row) => String(row.step)}
            />
          </div>

          {/* Element Contributions per Step */}
          {funnelData.steps.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-2 text-blue-900">Element Impact Analysis</h3>
              <p className="text-sm text-blue-800 mb-2">
                See which UI elements help or hurt progression through each funnel step. 
                This analysis requires click events with element tracking enabled.
              </p>
              <Link 
                href={`/sites/${siteId}/impact`}
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                View full Impact Dashboard <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
          {funnelData.steps.map((step, stepIndex) => {
            const contributions = step.elementContributions;
            if (!contributions || (!contributions.topPositive?.length && !contributions.topNegative?.length)) {
              // Show a placeholder for steps without contributions
              if (stepIndex < funnelData.steps.length - 1) {
                return (
                  <div key={stepIndex} className="bg-gray-50 p-4 rounded border border-gray-200 mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">
                      Step {step.step}: {step.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      No element contribution data available. Ensure click events are tracked with element IDs.
                    </p>
                  </div>
                );
              }
              return null;
            }

            return (
              <div key={stepIndex} className="bg-white p-6 rounded shadow mt-6">
                <h3 className="text-lg font-semibold mb-4">
                  Element Contributions for Step {step.step}: {step.name}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Positive Contributors */}
                  {contributions.topPositive.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-800 mb-3">Top Positive Contributors</h4>
                      <div className="space-y-2">
                        {contributions.topPositive.map((element, idx) => (
                          <div key={idx} className="bg-green-50 p-3 rounded border border-green-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-sm">{element.label || element.elementId}</div>
                                {element.role && (
                                  <span className="text-xs text-gray-500">{element.role}</span>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-green-600">
                                  +{(element.lift * 100).toFixed(1)}pp
                                </div>
                                <div className="text-xs text-gray-500">
                                  {(element.progressionRate * 100).toFixed(1)}% progression
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {element.sessionsAtStep} sessions → {element.sessionsAtNextStep} progressed
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Negative Contributors */}
                  {contributions.topNegative.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-800 mb-3">Top Negative Contributors</h4>
                      <div className="space-y-2">
                        {contributions.topNegative.map((element, idx) => (
                          <div key={idx} className="bg-red-50 p-3 rounded border border-red-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-sm">{element.label || element.elementId}</div>
                                {element.role && (
                                  <span className="text-xs text-gray-500">{element.role}</span>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-red-600">
                                  {(element.lift * 100).toFixed(1)}pp
                                </div>
                                <div className="text-xs text-gray-500">
                                  {(element.progressionRate * 100).toFixed(1)}% progression
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {element.sessionsAtStep} sessions → {element.sessionsAtNextStep} progressed
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Events per Step */}
          {expandedStep !== null && funnelData.stepEvents && funnelData.stepEvents[expandedStep] && (
            <div className="bg-white p-6 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">
                Events During Step {expandedStep + 1}: {funnelData.steps[expandedStep]?.name}
              </h3>
              <div className="space-y-4">
                {funnelData.stepEvents[expandedStep].slice(0, 20).map((stepEvent, idx) => (
                  <div key={idx} className="border rounded p-4">
                    <div className="font-semibold mb-2">Session: {stepEvent.sid.substring(0, 8)}...</div>
                    <div className="space-y-1 text-sm">
                      {stepEvent.events.map((event, eventIdx) => (
                        <div key={eventIdx} className="flex gap-4 text-gray-600">
                          <span className="font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                          <span className="font-semibold">{event.eventName || event.eventType}</span>
                          <span className="text-gray-500">{event.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {funnelData.stepEvents[expandedStep].length === 0 && (
                  <div className="text-gray-500">No events found for this step</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
