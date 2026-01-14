import { getDeviceInfo } from './device';
import { getUserDimensions, getSessionDimensions } from './dimensions';
import { setDebug } from './debug';

interface BatchConfig {
  siteId: string;
  key: string;
  endpoint: string;
  vid: string;
  sid: string;
  debug?: boolean;
}

let config: BatchConfig | null = null;
let debugMode = false;
const counters: Record<string, number> = {};
let flushTimer: ReturnType<typeof setInterval> | null = null;
const FLUSH_INTERVAL_MS = 10000;
const MAX_COUNTER_KEYS = 30;

// Queue constants
const QUEUE_KEY = '_aa_queue';
const MAX_QUEUE_SIZE = 200; // max payloads
const MAX_QUEUE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
let retryBackoff = 0; // exponential backoff in ms
const MAX_BACKOFF = 30000; // 30 seconds max

export const batch = {
  init(cfg: BatchConfig) {
    config = cfg;
    debugMode = cfg.debug || false;
    setDebug(debugMode);

    // Load and flush queue on init
    flushQueue();

    // Periodic flush
    flushTimer = setInterval(() => {
      flush();
    }, FLUSH_INTERVAL_MS);

    // Flush on pagehide
    window.addEventListener('pagehide', () => {
      flush();
      flushQueue();
    });

    // Flush on visibility change (hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flush();
        flushQueue();
      }
    });
  },

  increment(eventKey: string) {
    counters[eventKey] = (counters[eventKey] || 0) + 1;

    // Flush if too many keys
    if (Object.keys(counters).length >= MAX_COUNTER_KEYS) {
      flush();
    }
  },

  sendEvent(name: string, props?: Record<string, unknown>, eventDimensions?: Record<string, unknown>) {
    if (!config) return;
    sendPayload(buildEventPayload(name, props, eventDimensions));
  },
};

function flush() {
  if (!config || Object.keys(counters).length === 0) return;

  const payload = buildIncPayload(counters);
  sendPayload(payload);

  // Clear counters
  Object.keys(counters).forEach((key) => delete counters[key]);
}

// Store configured experiments (loaded from server or set via API)
let configuredExperiments: Array<{ name: string; storageType: 'localStorage' | 'cookie'; storageKey: string }> = [];

export function setExperiments(experiments: Array<{ name: string; storageType: 'localStorage' | 'cookie'; storageKey: string }>) {
  configuredExperiments = experiments;
}

function buildIncPayload(counters: Record<string, number>) {
  if (!config) throw new Error('Not initialized');

  const session = loadSession();
  const device = getDeviceInfo();
  const path = window.location.pathname + window.location.search;
  const userDims = getUserDimensions();
  const sessionDims = getSessionDimensions();
  
  // Read experiment variants and add as custom dimensions
  const experimentDims: Record<string, string> = {};
  configuredExperiments.forEach((exp) => {
    const variant = getExperimentVariant(exp.storageType, exp.storageKey);
    if (variant) {
      experimentDims[`experiment:${exp.name}`] = variant;
    }
  });
  
  // Merge user, session, and experiment dimensions (session takes precedence)
  const customDimensions = { ...userDims, ...sessionDims, ...experimentDims };

  return {
    type: 'inc',
    site_id: config.siteId,
    site_key: config.key, // Include key in body for sendBeacon compatibility
    vid: config.vid,
    sid: config.sid,
    ts: Math.floor(Date.now() / 1000),
    path,
    ref_domain: session?.ref,
    utm: session?.utm,
    device,
    counters,
    custom_dimensions: Object.keys(customDimensions).length > 0 ? customDimensions : undefined,
  };
}

function buildEventPayload(name: string, props?: Record<string, unknown>, eventDimensions?: Record<string, unknown>) {
  if (!config) throw new Error('Not initialized');

  const session = loadSession();
  const device = getDeviceInfo();
  const path = window.location.pathname + window.location.search;
  const userDims = getUserDimensions();
  const sessionDims = getSessionDimensions();
  
  // Read experiment variants and add as custom dimensions
  const experimentDims: Record<string, string> = {};
  configuredExperiments.forEach((exp) => {
    const variant = getExperimentVariant(exp.storageType, exp.storageKey);
    if (variant) {
      experimentDims[`experiment:${exp.name}`] = variant;
    }
  });
  
  // Merge user, session, experiment, and event dimensions (event takes highest precedence)
  const customDimensions = { ...userDims, ...sessionDims, ...experimentDims, ...(eventDimensions || {}) };

  return {
    type: 'event',
    site_id: config.siteId,
    site_key: config.key, // Include key in body for sendBeacon compatibility
    vid: config.vid,
    sid: config.sid,
    ts: Math.floor(Date.now() / 1000),
    path,
    name,
    props,
    ref_domain: session?.ref,
    utm: session?.utm,
    device,
    custom_dimensions: Object.keys(customDimensions).length > 0 ? customDimensions : undefined,
  };
}

// Queue management
interface QueuedPayload {
  created_at: number;
  type: string;
  body: unknown;
}

function getQueue(): QueuedPayload[] {
  try {
    const queueStr = localStorage.getItem(QUEUE_KEY);
    if (queueStr) {
      return JSON.parse(queueStr);
    }
  } catch {
    // Invalid queue data
  }
  return [];
}

function saveQueue(queue: QueuedPayload[]) {
  try {
    // Check size limits
    const queueStr = JSON.stringify(queue);
    const sizeBytes = new Blob([queueStr]).size;
    
    if (queue.length > MAX_QUEUE_SIZE || sizeBytes > MAX_QUEUE_SIZE_BYTES) {
      // Remove oldest items
      while ((queue.length > MAX_QUEUE_SIZE || new Blob([JSON.stringify(queue)]).size > MAX_QUEUE_SIZE_BYTES) && queue.length > 0) {
        queue.shift();
      }
    }
    
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
      // Failed to save queue
    // If storage is full, try to clear some space
    try {
      const reduced = queue.slice(-100); // Keep last 100
      localStorage.setItem(QUEUE_KEY, JSON.stringify(reduced));
    } catch {
      // Still failing, clear queue
      localStorage.removeItem(QUEUE_KEY);
    }
  }
}

function addToQueue(payload: unknown) {
  const queue = getQueue();
  queue.push({
    created_at: Date.now(),
    type: (payload as any).type || 'unknown',
    body: payload,
  });
  saveQueue(queue);
}

async function flushQueue() {
  if (!config) return;
  
  const queue = getQueue();
  if (queue.length === 0) {
    retryBackoff = 0;
    return;
  }

  const url = `${config.endpoint}/e`;
  const itemsToSend = [...queue];
  const successItems: number[] = [];

  // Try to send each item
  for (let i = 0; i < itemsToSend.length; i++) {
    const item = itemsToSend[i];
    const body = JSON.stringify(item.body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-site-id': config.siteId,
          'x-site-key': config.key,
        },
        keepalive: true,
        credentials: 'omit',
      });

      if (response.ok) {
        successItems.push(i);
        retryBackoff = 0; // Reset backoff on success
      } else {
        // Server error, keep in queue with backoff
        break;
      }
    } catch (error) {
      // Network error, keep in queue with backoff
      // Queue send failed
      break;
    }
  }

  // Remove successfully sent items
  if (successItems.length > 0) {
    const remaining = itemsToSend.filter((_, idx) => !successItems.includes(idx));
    saveQueue(remaining);
    
    // Flushed items from queue
  }

  // Schedule retry with exponential backoff if items remain
  if (itemsToSend.length > successItems.length) {
    retryBackoff = Math.min(retryBackoff * 2 || 1000, MAX_BACKOFF);
    setTimeout(flushQueue, retryBackoff);
  }
}

function sendPayload(payload: unknown) {
  if (!config) {
    // Not initialized
    return;
  }

  const url = `${config.endpoint}/e`;
  const body = JSON.stringify(payload);

  // Update session last timestamp
  updateSessionLast();

  // Prefer sendBeacon, fallback to fetch
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    const sent = navigator.sendBeacon(url, blob);
    if (sent) {
      // Event sent via sendBeacon
        type: (payload as any).type,
        name: (payload as any).name,
        hasProps: !!(payload as any).props,
        elementId: (payload as any).props?.elementId,
      });
      // Flush queue on successful send
      flushQueue();
    } else {
      // sendBeacon failed, add to queue
      addToQueue(payload);
      // sendBeacon failed
    }
  } else {
    fetch(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-site-id': config.siteId,
        'x-site-key': config.key,
      },
      keepalive: true,
      credentials: 'omit',
    }).then(() => {
      // Flush queue on successful send
      flushQueue();
    }).catch(() => {
      // Network error, add to queue
      addToQueue(payload);
    });
  }
}

function loadSession() {
  try {
    const sessStr = localStorage.getItem('_aa_sess');
    if (sessStr) {
      return JSON.parse(sessStr);
    }
  } catch {
    // Invalid
  }
  return null;
}

function updateSessionLast() {
  try {
    const sessStr = localStorage.getItem('_aa_sess');
    if (sessStr) {
      const session = JSON.parse(sessStr);
      session.last = Math.floor(Date.now() / 1000);
      localStorage.setItem('_aa_sess', JSON.stringify(session));
    }
  } catch {
    // Invalid
  }
}

