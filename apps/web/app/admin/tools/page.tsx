'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { getApiUrl } from '@/lib/api-client';

export default function AdminToolsPage() {
  const [siteId, setSiteId] = useState('');
  const [installScript, setInstallScript] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [importData, setImportData] = useState('');

  const handleGenerateInstall = async () => {
    if (!siteId) {
      toast.error('Site ID required');
      return;
    }

    try {
      const res = await fetch(getApiUrl(`/api/admin/install?siteId=${siteId}`));
      if (!res.ok) throw new Error('Failed to generate install script');
      const data = await res.json();
      setInstallScript(data.script || '');
    } catch (error: any) {
      toast.error('Failed to generate install script', { description: error.message });
    }
  };

  const handleVerify = async () => {
    if (!siteId) {
      toast.error('Site ID required');
      return;
    }

    try {
      const res = await fetch(getApiUrl(`/api/admin/verify?siteId=${siteId}`));
      if (!res.ok) throw new Error('Failed to verify');
      const data = await res.json();
      setVerifyResult(data);
      toast.success('Verification complete');
    } catch (error: any) {
      toast.error('Verification failed', { description: error.message });
    }
  };

  const handleImport = async () => {
    if (!siteId) {
      toast.error('Site ID required');
      return;
    }

    let data;
    try {
      data = JSON.parse(importData);
    } catch (e) {
      toast.error('Invalid JSON');
      return;
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, data }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to import');
      }

      const result = await res.json();
      toast.success(`Imported ${result.accepted || 0} events`);
      setImportData('');
    } catch (error: any) {
      toast.error('Import failed', { description: error.message });
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <h1 className="text-2xl font-bold">Admin Tools</h1>

      <div className="space-y-6">
        {/* Install Script Generator */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Install Script Generator</h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Site ID"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <button
              onClick={handleGenerateInstall}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Generate Script
            </button>
          </div>
          {installScript && (
            <div>
              <label className="block text-sm font-medium mb-2">Install Script</label>
              <textarea
                value={installScript}
                readOnly
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows={10}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(installScript);
                  toast.success('Copied to clipboard');
                }}
                className="mt-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>

        {/* Verification Tool */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Verification Tool</h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Site ID"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <button
              onClick={handleVerify}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Verify Installation
            </button>
          </div>
          {verifyResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <pre className="text-sm">{JSON.stringify(verifyResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Data Import Tool */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Data Import Tool</h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Site ID"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <label className="block text-sm font-medium mb-2">Event Data (JSON Array)</label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={10}
              placeholder='[{"event": "pageview", "path": "/", "ts": "2024-01-01T00:00:00Z"}, ...]'
            />
            <button
              onClick={handleImport}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Import Data
            </button>
          </div>
        </div>
        </div>
      </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

