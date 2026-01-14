import { batch } from './batch';

// Track API call performance
export function setupPerformanceTracking() {
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const startTime = performance.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    const method = typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET');
    
    try {
      const response = await originalFetch.apply(this, args);
      const duration = Math.round(performance.now() - startTime);
      const size = response.headers.get('content-length') ? parseInt(response.headers.get('content-length')!, 10) : null;
      
      // Track all API calls, but flag slow ones (>2s)
      if (duration > 2000 || !response.ok) {
        batch.sendEvent('performance', {
          type: 'api',
          name: url,
          method,
          duration,
          status: response.status,
          size: size || undefined,
          slow: duration > 2000,
          failed: !response.ok,
        });
      }
      
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      batch.sendEvent('performance', {
        type: 'api',
        name: url,
        method,
        duration,
        status: 0,
        failed: true,
      });
      throw error;
    }
  };
  
  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
    (this as any)._aa_url = url;
    (this as any)._aa_method = method;
    (this as any)._aa_startTime = performance.now();
    return originalXHROpen.apply(this, [method, url, ...rest] as any);
  };
  
  XMLHttpRequest.prototype.send = function(...args: any[]) {
    const xhr = this as any;
    const url = xhr._aa_url;
    const method = xhr._aa_method;
    
    xhr.addEventListener('load', () => {
      const duration = Math.round(performance.now() - (xhr._aa_startTime || 0));
      const size = xhr.responseText ? new Blob([xhr.responseText]).size : null;
      
      if (duration > 2000 || xhr.status >= 400) {
        batch.sendEvent('performance', {
          type: 'api',
          name: String(url),
          method,
          duration,
          status: xhr.status,
          size: size || undefined,
          slow: duration > 2000,
          failed: xhr.status >= 400,
        });
      }
    });
    
    xhr.addEventListener('error', () => {
      const duration = Math.round(performance.now() - (xhr._aa_startTime || 0));
      batch.sendEvent('performance', {
        type: 'api',
        name: String(url),
        method,
        duration,
        status: 0,
        failed: true,
      });
    });
    
    return originalXHRSend.apply(this, args);
  };
  
  // Track resource loading
  if ('PerformanceObserver' in window) {
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const duration = Math.round(entry.duration);
          const size = entry.transferSize || entry.decodedBodySize || null;
          
          // Track slow resources (>2s) or failed resources
          if (duration > 2000 || entry.responseStatus >= 400) {
            batch.sendEvent('performance', {
              type: 'resource',
              name: entry.name,
              duration,
              status: entry.responseStatus || null,
              size: size || undefined,
              slow: duration > 2000,
              failed: entry.responseStatus >= 400,
            });
          }
        });
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      // PerformanceObserver not supported
    }
  }
  
  // Track navigation timing
  if (window.performance && window.performance.getEntriesByType) {
    window.addEventListener('load', () => {
      const navEntries = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        const duration = Math.round(nav.loadEventEnd - nav.fetchStart);
        
        batch.sendEvent('performance', {
          type: 'navigation',
          name: window.location.pathname,
          duration,
          ttfb: Math.round(nav.responseStart - nav.fetchStart),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart),
          load: Math.round(nav.loadEventEnd - nav.fetchStart),
        });
      }
    });
  }
}


