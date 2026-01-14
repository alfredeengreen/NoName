'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ChartContainer from '@/components/ChartContainer';
import DataTable from '@/components/DataTable';
import { toast } from '@/lib/toast';

interface Campaign {
  id: string;
  name: string;
  utm_campaign: string | null;
  cost: number | null;
  visitors: number;
  sessions: number;
  conversions: number;
  revenue: number;
  roi_percent: number | null;
  cpa: number | null;
  revenue_per_visitor: number;
}

export default function CampaignsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    cost: '',
    budget: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  useEffect(() => {
    fetchCampaigns();
    fetchROI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, searchParams.get('start'), searchParams.get('end')]);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/marketing/campaigns`);
      const data = await res.json();
      // Campaigns list for management
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchROI = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/marketing/campaign-roi?start=${start}&end=${end}`);
      const data = await res.json();
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns.map((c: any) => ({
        ...c,
        cost: c.cost ? Number(c.cost) : null,
        revenue: Number(c.revenue || 0),
        roi_percent: c.roi_percent ? Number(c.roi_percent) : null,
        cpa: c.cpa ? Number(c.cpa) : null,
        revenue_per_visitor: Number(c.revenue_per_visitor || 0),
      })) : []);
    } catch (error) {
      console.error('Error fetching campaign ROI:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/app/api/sites/${siteId}/marketing/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        toast.success('Campaign created!');
        setShowCreateForm(false);
        setFormData({
          name: '',
          utmSource: '',
          utmMedium: '',
          utmCampaign: '',
          cost: '',
          budget: '',
          startDate: '',
          endDate: '',
          description: '',
        });
        fetchCampaigns();
        fetchROI();
      } else {
        throw new Error('Failed to create campaign');
      }
    } catch (error) {
      toast.error('Failed to create campaign');
    }
  };

  if (loading) {
    return <div className="p-8">Loading campaign data...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaign ROI</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Campaign'}
        </button>
      </div>

      {/* Create Campaign Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Create Campaign</h2>
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Campaign</label>
                <input
                  type="text"
                  value={formData.utmCampaign}
                  onChange={(e) => setFormData({ ...formData, utmCampaign: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Source</label>
                <input
                  type="text"
                  value={formData.utmSource}
                  onChange={(e) => setFormData({ ...formData, utmSource: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Medium</label>
                <input
                  type="text"
                  value={formData.utmMedium}
                  onChange={(e) => setFormData({ ...formData, utmMedium: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-md p-2"
                rows={3}
              />
            </div>
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Create Campaign
            </button>
          </form>
        </div>
      )}

      {/* Campaign ROI Chart */}
      {campaigns.length > 0 && (
        <div>
            <h3 className="text-lg font-semibold mb-4">Campaign ROI</h3>
            <ChartContainer height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaigns}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
              <Bar dataKey="cost" fill="#ef4444" name="Cost" />
            </BarChart>
          </ResponsiveContainer>
                  </ChartContainer>
        </div>
      )}

      {/* Campaign Performance Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <DataTable
          data={campaigns}
          columns={[
            { key: 'name', label: 'Campaign', sortable: true },
            { key: 'cost', label: 'Cost', sortable: true, render: (value) => value ? `$${Number(value).toFixed(2)}` : '-' },
            { key: 'revenue', label: 'Revenue', sortable: true, render: (value) => `$${Number(value).toFixed(2)}` },
            { key: 'roi_percent', label: 'ROI %', sortable: true, render: (value) => value ? `${Number(value).toFixed(1)}%` : '-' },
            { key: 'conversions', label: 'Conversions', sortable: true },
            { key: 'cpa', label: 'CPA', sortable: true, render: (value) => value ? `$${Number(value).toFixed(2)}` : '-' },
            { key: 'revenue_per_visitor', label: 'Rev/Visitor', sortable: true, render: (value) => `$${Number(value).toFixed(2)}` },
          ]}
          keyExtractor={(row) => row.id}
          pagination={{ pageSize: 20 }}
        />
      </div>

      {campaigns.length === 0 && (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          No campaign data available. Create a campaign to start tracking ROI.
        </div>
      )}
    </div>
  );
}

