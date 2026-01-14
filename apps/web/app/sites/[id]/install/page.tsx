'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Site {
  name: string;
  publicSiteId: string;
  publicWriteKey: string;
}

export default function InstallPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [site, setSite] = useState<Site | null>(null);
  const [copied, setCopied] = useState(false);
  const [collectorUrl, setCollectorUrl] = useState('https://noname.fyi/collector');

  useEffect(() => {
    fetch(`/app/api/sites/${siteId}`)
      .then((res) => res.json())
      .then((data) => setSite(data.site))
      .catch(console.error);
  }, [siteId]);

  useEffect(() => {
    // Use environment variable if available, otherwise use production domain
    if (typeof window !== 'undefined') {
      const envUrl = process.env.NEXT_PUBLIC_COLLECTOR_URL;
      setCollectorUrl(envUrl || 'https://noname.fyi/collector');
    }
  }, []);

  if (!site) {
    return <div className="p-8">Loading...</div>;
  }
  // Always use production domain for webApiUrl (include basePath)
  const webApiUrl = 'https://noname.fyi/app';
  const snippet = `<script>
  (function() {
    // Optional: Load html2canvas for heatmap screenshots (recommended)
    var html2canvasScript = document.createElement('script');
    html2canvasScript.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    html2canvasScript.async = true;
    document.head.appendChild(html2canvasScript);
    
    var script = document.createElement('script');
    script.src = '${collectorUrl}/analytics.js';
    script.async = true;
    script.onload = function() {
      // Poll for window.aa.init to be available (script might still be initializing)
      var attempts = 0;
      var maxAttempts = 50; // Try for up to 5 seconds (50 * 100ms)
      var checkInit = function() {
        attempts++;
        // Check window.aa explicitly (not just aa, which might be undefined)
        if (typeof window.aa !== 'undefined' && typeof window.aa.init === 'function') {
          window.aa.init({
            siteId: '${site.publicSiteId}',
            key: '${site.publicWriteKey}',
            endpoint: '${collectorUrl}',
            webApiUrl: '${webApiUrl}'
          });
        } else if (attempts < maxAttempts) {
          setTimeout(checkInit, 100);
        } else {
          // Fallback: try queue pattern if init never becomes available
          if (typeof window.aa !== 'undefined') {
            window.aa('init', {
              siteId: '${site.publicSiteId}',
              key: '${site.publicWriteKey}',
              endpoint: '${collectorUrl}',
              webApiUrl: '${webApiUrl}'
            });
          } else {
            console.warn('No Name Analytics: Script loaded but window.aa not available');
          }
        }
      };
      checkInit();
    };
    script.onerror = function() {
      console.error('No Name Analytics: Failed to load script from ${collectorUrl}/analytics.js');
    };
    // Also try immediate initialization if script already loaded
    if (typeof window.aa !== 'undefined' && typeof window.aa.init === 'function') {
      window.aa.init({
        siteId: '${site.publicSiteId}',
        key: '${site.publicWriteKey}',
        endpoint: '${collectorUrl}',
        webApiUrl: '${webApiUrl}'
      });
    }
    document.head.appendChild(script);
  })();
</script>`;

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Install Tracker</h1>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Installation Snippet</h2>
          <p className="text-sm text-gray-600 mb-4">
            Copy and paste this code into the &lt;head&gt; section of your website.
          </p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm overflow-x-auto relative">
            <button
              onClick={copyToClipboard}
              className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="whitespace-pre-wrap">{snippet}</pre>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">First-Party Proxy Setup</h2>
          <p className="text-sm text-gray-600 mb-4">
            For first-party mode, set up a proxy on your domain:
          </p>
          <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto">
            <pre>{`location /analytics.js {
  proxy_pass https://noname.fyi/collector/analytics.js;
  proxy_set_header Host $host;
}
location /e {
  proxy_pass https://noname.fyi/collector/e;
  proxy_set_header Host $host;
}`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

