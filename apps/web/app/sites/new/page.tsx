'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api-client';

export default function NewSitePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Client-side validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Site name is required');
      return;
    }

    if (trimmedName.length > 255) {
      setError('Site name must be 255 characters or less');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/sites/new'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.siteId) {
          router.push(`/sites/${data.siteId}/overview`);
        } else {
          setError('Site created but no site ID returned. Please refresh the page.');
        }
      } else {
        // Display the actual error message from the API
        const errorMsg = data.error || 'Failed to create site. Please try again.';
        console.error('Site creation failed:', {
          status: res.status,
          error: errorMsg,
          details: data.details,
        });
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('Error creating site:', err);
      setError(err.message || 'Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Site</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="site-name" className="block text-sm font-medium mb-1">
            Site Name
          </label>
          <input
            id="site-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(''); // Clear error when user types
            }}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            placeholder="My Website"
            maxLength={255}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {name.length}/255 characters
          </p>
        </div>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating Site...' : 'Create Site'}
        </button>
      </form>
    </div>
  );
}

