'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

export default function ImportPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ accepted: number; rejected: number; errors: Array<{ row: number; error: string }> } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      let data: any[];

      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parsing (for MVP)
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        data = lines.slice(1).map((line) => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header.trim()] = values[i]?.trim();
          });
          return obj;
        });
      } else {
        throw new Error('Unsupported file format. Use JSON or CSV.');
      }

      const res = await fetch(`/app/api/sites/${siteId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      const importResult = await res.json();
      setResult(importResult);
      setLoading(false);
    } catch (error: any) {
      console.error('Error importing:', error);
      setResult({ accepted: 0, rejected: 0, errors: [{ row: 0, error: error.message }] });
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Data Import</h1>

      <div className="bg-white p-6 rounded shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Upload File (JSON or CSV)</label>
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            className="border rounded-md p-2 w-full"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Importing...' : 'Import Data'}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Import Results</h3>
            <div className="space-y-1 text-sm">
              <div>Accepted: {result.accepted}</div>
              <div>Rejected: {result.rejected}</div>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold">Errors:</div>
                  <ul className="list-disc list-inside">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>Row {err.row}: {err.error}</li>
                    ))}
                    {result.errors.length > 10 && <li>... and {result.errors.length - 10} more</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-semibold mb-2">Import Format</h3>
        <p className="text-sm mb-2">Upload a JSON or CSV file with event data. Each row should be a valid payload matching the tracker format:</p>
        <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`{
  "type": "event",
  "site_id": "...",
  "vid": "...",
  "sid": "...",
  "ts": 1234567890,
  "path": "/page",
  "name": "purchase",
  "value": 99.99,
  "items": [...]
}`}
        </pre>
      </div>
    </div>
  );
}


