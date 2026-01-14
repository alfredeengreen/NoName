import { capture } from './capture';
import { batch } from './batch';
import { getDeviceInfo } from './device';
import { setDebug, debugLog } from './debug';

interface InitConfig {
  siteId: string;
  key: string;
  endpoint: string;
  webApiUrl?: string; // Optional web API URL for custom event trackers
  debug?: boolean; // Enable debug logging
  heatmapEnabled?: boolean; // Override heatmap feature flag
  replayEnabled?: boolean; // Override replay feature flag
}

let initialized = false;

export function init(config: InitConfig) {
  if (initialized) {
    return;
  }
  initialized = true;

  // Generate or load visitor ID
  let vid = localStorage.getItem('_aa_vid');
  if (!vid) {
    vid = generateId();
    localStorage.setItem('_aa_vid', vid);
  }

  // Load or create session
  let session = loadSession();
  const now = Math.floor(Date.now() / 1000);

  // Check if session expired (30 min inactivity)
  if (session && now - session.last > 1800) {
    session = null;
  }

  // Parse UTM params
  const urlParams = new URLSearchParams(window.location.search);
  const utm = {
    source: urlParams.get('utm_source') || undefined,
    medium: urlParams.get('utm_medium') || undefined,
    campaign: urlParams.get('utm_campaign') || undefined,
    content: urlParams.get('utm_content') || undefined,
    term: urlParams.get('utm_term') || undefined,
  };

  // Check if UTM changed (new session)
  if (session && hasUtmChanged(session.utm, utm)) {
    session = null;
  }

  // Create new session if needed
  if (!session) {
    const refDomain = getReferrerDomain();
    session = {
      sid: generateId(),
      start: now,
      last: now,
      utm,
      ref: refDomain,
    };
  } else {
    session.last = now;
    if (Object.keys(utm).some((k) => utm[k as keyof typeof utm])) {
      session.utm = utm;
    }
  }

  saveSession(session);

  // Store siteId and webApiUrl globally for custom event trackers
  (window as any).__aa_siteId = config.siteId;
  if (config.webApiUrl) {
    (window as any).__aa_webApiUrl = config.webApiUrl;
  }

  // Initialize batch with config
  batch.init({
    siteId: config.siteId,
    key: config.key,
    endpoint: config.endpoint,
    vid,
    sid: session.sid,
    debug: config.debug,
  });

  // Set up auto-capture
  capture.setup();

  // Conditionally set up heatmap and replay based on feature flags
  // Check server config if webApiUrl is provided, otherwise use init config overrides
  if (config.webApiUrl) {
    // Fetch site config from server
    fetch(`${config.webApiUrl}/api/sites/${config.siteId}/config`)
      .then(res => res.json())
      .then(siteConfig => {
        const heatmapEnabled = config.heatmapEnabled ?? siteConfig.heatmapEnabled ?? false;
        const replayEnabled = config.replayEnabled ?? siteConfig.replayEnabled ?? false;

        if (heatmapEnabled) {
          import('./heatmap').then(m => m.setupHeatmapTracking());
        }
        if (replayEnabled) {
          import('./replay').then(m => m.setupSessionReplay());
        }
      })
      .catch(() => {
        // If config fetch fails, use init config overrides or defaults
        if (config.heatmapEnabled) {
          import('./heatmap').then(m => m.setupHeatmapTracking());
        }
        if (config.replayEnabled) {
          import('./replay').then(m => m.setupSessionReplay());
        }
      });
  } else {
    // No webApiUrl, use init config overrides or defaults (both false by default)
    if (config.heatmapEnabled) {
      import('./heatmap').then(m => m.setupHeatmapTracking());
    }
    if (config.replayEnabled) {
      import('./replay').then(m => m.setupSessionReplay());
    }
  }

  // Set debug mode
  setDebug(config.debug || false);

  // Send initial pageview
  capture.sendPageview();
  
  // Initialized
}

interface Session {
  sid: string;
  start: number;
  last: number;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  ref?: string;
}

function loadSession(): Session | null {
  try {
    const sessStr = localStorage.getItem('_aa_sess');
    if (sessStr) {
      return JSON.parse(sessStr);
    }
  } catch {
    // Invalid session data
  }
  return null;
}

function saveSession(session: Session) {
  localStorage.setItem('_aa_sess', JSON.stringify(session));
}

function hasUtmChanged(oldUtm: Session['utm'], newUtm: Session['utm']): boolean {
  return (
    oldUtm.source !== newUtm.source ||
    oldUtm.medium !== newUtm.medium ||
    oldUtm.campaign !== newUtm.campaign ||
    oldUtm.content !== newUtm.content ||
    oldUtm.term !== newUtm.term
  );
}

function getReferrerDomain(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    return url.hostname;
  } catch {
    return undefined;
  }
}

function generateId(): string {
  // Simple ID generator (nanoid-like, URL-safe)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

