import { batch } from './batch';
import { getDeviceInfo } from './device';

interface RecordingEvent {
  type: 'click' | 'input' | 'navigation' | 'error' | 'custom';
  timestamp: number;
  data: Record<string, any>;
}

interface DOMSnapshot {
  timestamp: number;
  html: string;
  width: number;
  height: number;
}

// Recording buffer
const recordingEvents: RecordingEvent[] = [];
const snapshots: DOMSnapshot[] = [];
const MAX_EVENTS = 1000;
const MAX_SNAPSHOTS = 10;
const RECORDING_DURATION_MS = 30 * 60 * 1000; // 30 minutes max

let recordingStartTime = Date.now();
let isRecording = false;

// Sanitize HTML (remove PII)
function sanitizeHTML(html: string): string {
  let sanitized = html;
  
  // Remove input values (except non-sensitive types)
  sanitized = sanitized.replace(/<input[^>]*value="[^"]*"[^>]*>/gi, (match) => {
    const type = match.match(/type="([^"]*)"/i)?.[1]?.toLowerCase();
    if (type === 'password' || type === 'email' || type === 'tel') {
      return match.replace(/value="[^"]*"/i, 'value="[REDACTED]"');
    }
    return match;
  });
  
  // Remove textarea content
  sanitized = sanitized.replace(/<textarea[^>]*>.*?<\/textarea>/gi, '<textarea>[REDACTED]</textarea>');
  
  // Remove credit card patterns
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  
  return sanitized;
}

// Take DOM snapshot
function takeSnapshot() {
  if (snapshots.length >= MAX_SNAPSHOTS) {
    snapshots.shift(); // Remove oldest
  }
  
  const html = sanitizeHTML(document.documentElement.outerHTML);
  snapshots.push({
    timestamp: Date.now() - recordingStartTime,
    html,
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

// Add recording event
function addEvent(type: RecordingEvent['type'], data: Record<string, any>) {
  if (!isRecording) return;
  
  if (recordingEvents.length >= MAX_EVENTS) {
    recordingEvents.shift(); // Remove oldest
  }
  
  recordingEvents.push({
    type,
    timestamp: Date.now() - recordingStartTime,
    data,
  });
}

// Send recording
function sendRecording() {
  if (recordingEvents.length === 0 && snapshots.length === 0) return;
  
  const path = window.location.pathname + window.location.search;
  const device = getDeviceInfo();
  const duration = Math.round((Date.now() - recordingStartTime) / 1000);
  
  batch.sendEvent('recording', {
    path,
    duration,
    events: JSON.stringify(recordingEvents),
    snapshots: JSON.stringify(snapshots),
    metadata: JSON.stringify({
      device,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      url: window.location.href,
    }),
  });
  
  // Clear buffers
  recordingEvents.length = 0;
  snapshots.length = 0;
}

// Track clicks
function setupClickTracking() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const selector = getSelector(target);
    
    addEvent('click', {
      selector,
      tag: target.tagName,
      text: target.textContent?.substring(0, 100),
      x: e.clientX,
      y: e.clientY,
    });
  }, true);
}

// Track form inputs
function setupInputTracking() {
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    const form = target.closest('form');
    if (form) {
      const fieldName = (target as HTMLInputElement).name || (target as HTMLInputElement).id || 'unknown';
      const fieldType = (target as HTMLInputElement).type || 'text';
      
      // Don't record sensitive fields
      if (fieldType === 'password' || fieldType === 'email') {
        return;
      }
      
      addEvent('input', {
        formId: form.id || form.name || 'unknown',
        fieldName,
        fieldType,
        valueLength: (target as HTMLInputElement).value.length,
      });
      
      // Take snapshot on significant form interactions
      if (snapshots.length < MAX_SNAPSHOTS) {
        takeSnapshot();
      }
    }
  }, true);
}

// Track navigation
function setupNavigationTracking() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    addEvent('navigation', {
      type: 'pushState',
      path: window.location.pathname,
    });
    takeSnapshot(); // Take snapshot on navigation
    return originalPushState.apply(history, args);
  };
  
  history.replaceState = function(...args) {
    addEvent('navigation', {
      type: 'replaceState',
      path: window.location.pathname,
    });
    return originalReplaceState.apply(history, args);
  };
  
  window.addEventListener('popstate', () => {
    addEvent('navigation', {
      type: 'popstate',
      path: window.location.pathname,
    });
    takeSnapshot();
  });
}

// Track errors
function setupErrorTracking() {
  window.addEventListener('error', () => {
    addEvent('error', {
      message: 'JavaScript error occurred',
    });
    takeSnapshot(); // Take snapshot on error
  }, true);
  
  window.addEventListener('unhandledrejection', () => {
    addEvent('error', {
      message: 'Unhandled promise rejection',
    });
  });
}

// Get CSS selector
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

// Initialize session replay
export function setupSessionReplay() {
  // Only record a percentage of sessions (10% by default to manage storage)
  if (Math.random() > 0.1) {
    return; // Skip this session
  }
  
  isRecording = true;
  recordingStartTime = Date.now();
  
  // Take initial snapshot
  takeSnapshot();
  
  // Setup event tracking
  setupClickTracking();
  setupInputTracking();
  setupNavigationTracking();
  setupErrorTracking();
  
  // Send recording periodically (every 30 seconds) and on page unload
  const sendInterval = setInterval(() => {
    if (Date.now() - recordingStartTime > RECORDING_DURATION_MS) {
      // Stop recording after max duration
      isRecording = false;
      clearInterval(sendInterval);
    }
    sendRecording();
  }, 30000);
  
  window.addEventListener('beforeunload', () => {
    sendRecording();
  });
  
  window.addEventListener('pagehide', () => {
    sendRecording();
  });
}


