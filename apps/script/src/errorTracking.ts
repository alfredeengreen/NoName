import { batch } from './batch';
import { getDeviceInfo } from './device';

interface StackFrame {
  filename?: string;
  function?: string;
  line?: number;
  column?: number;
  source?: string;
}

interface Breadcrumb {
  type: 'navigation' | 'click' | 'console' | 'network' | 'error' | 'custom';
  message: string;
  data?: Record<string, any>;
  timestamp: number;
}

interface ErrorContext {
  url: string;
  line?: number;
  column?: number;
  stack?: string;
  message: string;
  type: 'js' | 'network' | 'resource' | 'promise';
  userAgent?: string;
  breadcrumbs: Breadcrumb[];
  context?: Record<string, any>;
}

// Breadcrumb storage (max 100 breadcrumbs)
const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 100;

// Add breadcrumb
export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>) {
  breadcrumbs.push({
    ...breadcrumb,
    timestamp: Date.now(),
  });
  
  // Keep only last MAX_BREADCRUMBS
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

// Parse stack trace
function parseStackTrace(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stack.split('\n');
  
  for (const line of lines) {
    // Match patterns like: "at functionName (file:///path/to/file.js:123:45)"
    // or "at file:///path/to/file.js:123:45"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      frames.push({
        function: match[1]?.trim() || 'anonymous',
        filename: match[2]?.trim(),
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
        source: line.trim(),
      });
    }
  }
  
  return frames;
}

// Generate fingerprint for error grouping
function generateFingerprint(message: string, stack?: string): string {
  // Simple hash function
  let hash = 0;
  const str = message + (stack || '');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Sanitize error message (remove PII, URLs)
function sanitizeMessage(message: string): string {
  let sanitized = message;
  
  // Remove URLs
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
  
  // Remove email-like patterns
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // Remove potential credit card patterns
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  
  // Truncate long messages
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...';
  }
  
  return sanitized;
}

// Capture JavaScript error
function captureJSError(error: ErrorEvent | PromiseRejectionEvent) {
  const device = getDeviceInfo();
  const url = window.location.href;
  
  let message = '';
  let filename = '';
  let lineno: number | undefined;
  let colno: number | undefined;
  let stack: string | undefined;
  let type: 'js' | 'promise' = 'js';
  
  if (error instanceof ErrorEvent) {
    message = error.message || 'Unknown error';
    filename = error.filename || url;
    lineno = error.lineno;
    colno = error.colno;
    stack = (error.error as Error)?.stack;
  } else if (error instanceof PromiseRejectionEvent) {
    type = 'promise';
    const reason = error.reason;
    if (reason instanceof Error) {
      message = reason.message || 'Unhandled promise rejection';
      stack = reason.stack;
    } else {
      message = String(reason) || 'Unhandled promise rejection';
    }
    filename = url;
  }
  
  const sanitizedMessage = sanitizeMessage(message);
  const fingerprint = generateFingerprint(sanitizedMessage, stack);
  const stackFrames = stack ? parseStackTrace(stack) : [];
  
  // Get current breadcrumbs (copy)
  const currentBreadcrumbs = [...breadcrumbs];
  
  // Add error breadcrumb
  addBreadcrumb({
    type: 'error',
    message: sanitizedMessage,
    data: { filename, line: lineno, column: colno },
  });
  
  // Build error context
  const errorContext: ErrorContext = {
    url: filename,
    line: lineno,
    column: colno,
    stack,
    message: sanitizedMessage,
    type,
    userAgent: navigator.userAgent,
    breadcrumbs: currentBreadcrumbs,
    context: {
      device,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      referrer: document.referrer,
    },
  };
  
  // Send error to collector (error data in props)
  batch.sendEvent('error', {
    fingerprint,
    type,
    message: sanitizedMessage,
    stackTrace: JSON.stringify(stackFrames),
    url: filename,
    line: lineno?.toString(),
    column: colno?.toString(),
    breadcrumbs: JSON.stringify(currentBreadcrumbs),
    context: JSON.stringify(errorContext.context),
  });
}

// Track network errors
function setupNetworkErrorTracking() {
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const startTime = Date.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    addBreadcrumb({
      type: 'network',
      message: `Fetch: ${url}`,
      data: { method: 'GET', url },
    });
    
    try {
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        addBreadcrumb({
          type: 'network',
          message: `Fetch failed: ${url}`,
          data: { status: response.status, duration },
        });
        
        batch.sendEvent('error', {
          fingerprint: generateFingerprint(`Network error: ${response.status} ${url}`),
          type: 'network',
          message: `Network error: ${response.status} ${url}`,
          url,
          context: JSON.stringify({ status: response.status, duration }),
        });
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      addBreadcrumb({
        type: 'network',
        message: `Fetch error: ${url}`,
        data: { error: errorMessage, duration },
      });
      
        batch.sendEvent('error', {
          fingerprint: generateFingerprint(`Network error: ${errorMessage} ${url}`),
          type: 'network',
          message: `Network error: ${errorMessage}`,
          url,
          context: JSON.stringify({ error: errorMessage, duration }),
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
    (this as any)._aa_startTime = Date.now();
    
    addBreadcrumb({
      type: 'network',
      message: `XHR: ${method} ${url}`,
      data: { method, url: String(url) },
    });
    
    return originalXHROpen.apply(this, [method, url, ...rest] as any);
  };
  
  XMLHttpRequest.prototype.send = function(...args: any[]) {
    const xhr = this as any;
    const url = xhr._aa_url;
    const method = xhr._aa_method;
    
    xhr.addEventListener('error', () => {
      const duration = Date.now() - (xhr._aa_startTime || Date.now());
      
      addBreadcrumb({
        type: 'network',
        message: `XHR error: ${method} ${url}`,
        data: { method, url, duration },
      });
      
      batch.sendEvent('error', {
        fingerprint: generateFingerprint(`XHR error: ${method} ${url}`),
        type: 'network',
        message: `XHR error: ${method} ${url}`,
        url: String(url),
        context: JSON.stringify({ method, duration }),
      });
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 400) {
        const duration = Date.now() - (xhr._aa_startTime || Date.now());
        
        addBreadcrumb({
          type: 'network',
          message: `XHR failed: ${method} ${url}`,
          data: { method, url, status: xhr.status, duration },
        });
        
        batch.sendEvent('error', {
          fingerprint: generateFingerprint(`XHR error: ${xhr.status} ${method} ${url}`),
          type: 'network',
          message: `XHR error: ${xhr.status} ${method} ${url}`,
          url: String(url),
          context: JSON.stringify({ method, status: xhr.status, duration }),
        });
      }
    });
    
    return originalXHRSend.apply(this, args);
  };
}

// Track resource loading errors
function setupResourceErrorTracking() {
  window.addEventListener('error', (e) => {
    const target = e.target as HTMLElement;
    
    // Only track resource errors (not script errors, those are handled separately)
    if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const src = (target as HTMLImageElement).src || (target as HTMLLinkElement).href || '';
      
      addBreadcrumb({
        type: 'error',
        message: `Resource failed to load: ${target.tagName}`,
        data: { tag: target.tagName, src },
      });
      
        batch.sendEvent('error', {
          fingerprint: generateFingerprint(`Resource error: ${target.tagName} ${src}`),
          type: 'resource',
          message: `Resource failed to load: ${target.tagName}`,
          url: src,
          context: JSON.stringify({ tag: target.tagName }),
        });
    }
  }, true); // Use capture phase
}

// Track console errors
function setupConsoleErrorTracking() {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.error = function(...args: any[]) {
    addBreadcrumb({
      type: 'console',
      message: args.map(a => String(a)).join(' '),
      data: { level: 'error' },
    });
    return originalConsoleError.apply(console, args);
  };
  
  console.warn = function(...args: any[]) {
    addBreadcrumb({
      type: 'console',
      message: args.map(a => String(a)).join(' '),
      data: { level: 'warn' },
    });
    return originalConsoleWarn.apply(console, args);
  };
}

// Track navigation
function setupNavigationTracking() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    addBreadcrumb({
      type: 'navigation',
      message: `Navigate to ${window.location.pathname}`,
      data: { path: window.location.pathname },
    });
    return originalPushState.apply(history, args);
  };
  
  history.replaceState = function(...args) {
    addBreadcrumb({
      type: 'navigation',
      message: `Replace to ${window.location.pathname}`,
      data: { path: window.location.pathname },
    });
    return originalReplaceState.apply(history, args);
  };
  
  window.addEventListener('popstate', () => {
    addBreadcrumb({
      type: 'navigation',
      message: `Popstate to ${window.location.pathname}`,
      data: { path: window.location.pathname },
    });
  });
}

// Track clicks
function setupClickTracking() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const selector = getSelector(target);
    
    addBreadcrumb({
      type: 'click',
      message: `Click: ${selector}`,
      data: { selector, tag: target.tagName },
    });
  }, true);
}

// Get CSS selector for element
function getSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  
  return element.tagName.toLowerCase();
}

// Initialize error tracking
export function setupErrorTracking() {
  // Track JavaScript errors
  window.addEventListener('error', captureJSError, true);
  
  // Track promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    captureJSError(e);
  });
  
  // Track network errors
  setupNetworkErrorTracking();
  
  // Track resource errors
  setupResourceErrorTracking();
  
  // Track console errors
  setupConsoleErrorTracking();
  
  // Track navigation
  setupNavigationTracking();
  
  // Track clicks
  setupClickTracking();
  
  // Initial breadcrumb
  addBreadcrumb({
    type: 'navigation',
    message: `Page load: ${window.location.pathname}`,
    data: { path: window.location.pathname },
  });
}

// Export for manual error reporting
export function captureError(error: Error, context?: Record<string, any>) {
  const device = getDeviceInfo();
  const url = window.location.href;
  const stack = error.stack;
  const sanitizedMessage = sanitizeMessage(error.message);
  const fingerprint = generateFingerprint(sanitizedMessage, stack);
  const stackFrames = stack ? parseStackTrace(stack) : [];
  
  const currentBreadcrumbs = [...breadcrumbs];
  
  batch.sendEvent('error', {
    fingerprint,
    type: 'js',
    message: sanitizedMessage,
    stackTrace: JSON.stringify(stackFrames),
    url,
    breadcrumbs: JSON.stringify(currentBreadcrumbs),
    context: JSON.stringify({
      ...context,
      device,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    }),
  });
}

