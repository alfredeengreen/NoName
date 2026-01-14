'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface CustomEventTracker {
  id: string;
  eventName: string;
  value: string | null;
  cssSelector: string;
  cssClasses: string[];
  elementTag: string | null;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SelectedElement {
  tag: string;
  classes: string[];
  selector: string;
  id?: string;
}

export default function CustomEventsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [trackers, setTrackers] = useState<CustomEventTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    eventName: '',
    value: '',
    description: '',
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchTrackers();
  }, [siteId]);

  useEffect(() => {
    if (iframeUrl && selectionMode && iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeWindow = iframe.contentWindow;
      
      if (!iframeWindow) return;

      // Inject click detection script into iframe
      const script = `
        (function() {
          let highlightEl = null;
          
          function removeHighlight() {
            if (highlightEl) {
              highlightEl.style.outline = '';
              highlightEl = null;
            }
          }
          
          function highlightElement(el) {
            removeHighlight();
            highlightEl = el;
            el.style.outline = '3px solid #3b82f6';
            el.style.outlineOffset = '2px';
          }
          
          function getSelector(el) {
            if (el.id) {
              return '#' + el.id;
            }
            
            let path = [];
            while (el && el.nodeType === 1) {
              let selector = el.nodeName.toLowerCase();
              if (el.className) {
                const classes = el.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                  selector += '.' + classes.join('.');
                }
              }
              path.unshift(selector);
              el = el.parentElement;
            }
            return path.join(' > ');
          }
          
          function handleClick(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const target = e.target;
            const tag = target.tagName.toLowerCase();
            const classes = target.className ? target.className.split(' ').filter(c => c.trim()) : [];
            const selector = getSelector(target);
            const id = target.id || undefined;
            
            highlightElement(target);
            
            window.parent.postMessage({
              type: 'element-selected',
              data: { tag, classes, selector, id }
            }, '*');
          }
          
          document.addEventListener('click', handleClick, true);
          
          // Cleanup on unload
          window.addEventListener('beforeunload', () => {
            document.removeEventListener('click', handleClick, true);
          });
        })();
      `;

      try {
        const iframeDoc = iframeWindow.document;
        const scriptEl = iframeDoc.createElement('script');
        scriptEl.textContent = script;
        iframeDoc.head.appendChild(scriptEl);
      } catch (error) {
        console.error('Error injecting script:', error);
      }
    }
  }, [iframeUrl, selectionMode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'element-selected') {
        setSelectedElement(event.data.data);
        setSelectionMode(false);
        setShowForm(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchTrackers = async () => {
    try {
      const res = await fetch(`/app/api/sites/${siteId}/custom-events`);
      if (!res.ok) {
        throw new Error('Failed to fetch trackers');
      }
      const data = await res.json();
      setTrackers(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching trackers:', error);
      setTrackers([]);
      setLoading(false);
    }
  };

  const isSameOrigin = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString, window.location.href);
      return urlObj.origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const handleLoadUrl = () => {
    if (!url.trim()) {
      alert('Please enter a URL');
      return;
    }

    if (!isSameOrigin(url)) {
      alert('Only same-origin URLs are supported for security reasons. Please enter a URL from the same domain.');
      return;
    }

    setIframeUrl(url);
    setSelectionMode(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElement) return;

    try {
      const value = formData.value ? parseFloat(formData.value) : null;
      if (formData.value && isNaN(value as number)) {
        alert('Value must be a valid number');
        return;
      }

      const res = await fetch(`/app/api/sites/${siteId}/custom-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: formData.eventName,
          value,
          cssSelector: selectedElement.selector,
          cssClasses: selectedElement.classes,
          elementTag: selectedElement.tag,
          description: formData.description || null,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({ eventName: '', value: '', description: '' });
        setSelectedElement(null);
        setSelectionMode(false);
        fetchTrackers();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create tracker');
      }
    } catch (error) {
      console.error('Error creating tracker:', error);
      alert('Failed to create tracker');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/app/api/sites/${siteId}/custom-events`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      });
      fetchTrackers();
    } catch (error) {
      console.error('Error toggling tracker:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tracker?')) return;

    try {
      const res = await fetch(`/app/api/sites/${siteId}/custom-events?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchTrackers();
      }
    } catch (error) {
      console.error('Error deleting tracker:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading trackers...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Event Trackers</h1>
      </div>

      {/* URL Input Section */}
      <div className="bg-white p-6 rounded shadow space-y-4">
        <h2 className="text-lg font-semibold">Set Up New Tracker</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL (same-origin only)"
            className="flex-1 border rounded-md p-2"
            onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
          />
          <button
            onClick={handleLoadUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Load URL
          </button>
        </div>
        {selectionMode && (
          <div className="bg-blue-50 p-3 rounded text-sm">
            <p className="font-semibold text-blue-800">Selection Mode Active</p>
            <p className="text-blue-600">Click on any element in the iframe below to select it for tracking.</p>
          </div>
        )}
      </div>

      {/* Iframe Section */}
      {iframeUrl && (
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Preview</h2>
            <button
              onClick={() => {
                setIframeUrl(null);
                setSelectionMode(false);
                setSelectedElement(null);
                setShowForm(false);
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          </div>
          <div className="border rounded-md overflow-hidden" style={{ height: '600px' }}>
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              className="w-full h-full"
              style={{ border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Configuration Form */}
      {showForm && selectedElement && (
        <div className="bg-white p-6 rounded shadow space-y-4">
          <h2 className="text-lg font-semibold">Configure Event</h2>
          <div className="bg-gray-50 p-4 rounded text-sm space-y-2">
            <p><strong>Selected Element:</strong> {selectedElement.tag}</p>
            {selectedElement.classes.length > 0 && (
              <p><strong>Classes:</strong> {selectedElement.classes.join(', ')}</p>
            )}
            <p><strong>Selector:</strong> <code className="bg-white px-2 py-1 rounded">{selectedElement.selector}</code></p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Event Name *</label>
              <input
                type="text"
                value={formData.eventName}
                onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                className="w-full border rounded-md p-2"
                placeholder="e.g., button_click, cta_signup"
                pattern="[a-zA-Z0-9_]+"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Only alphanumeric characters and underscores allowed</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Value (optional)</label>
              <input
                type="number"
                step="any"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full border rounded-md p-2"
                placeholder="e.g., 99.99"
              />
              <p className="text-xs text-gray-500 mt-1">Numeric value to associate with this event</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-md p-2"
                rows={3}
                placeholder="Describe what this event tracks"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Tracker
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSelectedElement(null);
                  setFormData({ eventName: '', value: '', description: '' });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trackers List */}
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Existing Trackers</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Event Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Selector</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Value</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trackers.map((tracker) => (
              <tr key={tracker.id} className="border-t">
                <td className="px-4 py-3 font-mono text-sm">{tracker.eventName}</td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{tracker.cssSelector}</code>
                </td>
                <td className="px-4 py-3">{tracker.value || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${tracker.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {tracker.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(tracker.id, tracker.enabled)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {tracker.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(tracker.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {trackers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No custom event trackers defined. Load a URL and select an element to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 p-4 rounded">
        <h3 className="font-semibold mb-2">How It Works</h3>
        <div className="text-sm space-y-2">
          <p>1. Enter a URL from the same domain as this analytics app</p>
          <p>2. Click on any element in the loaded page to select it</p>
          <p>3. Configure the event name and optional value</p>
          <p>4. The tracking script will automatically detect clicks on matching elements and send events</p>
        </div>
      </div>
    </div>
  );
}


