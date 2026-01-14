// Global queue pattern - Set window.aa FIRST before any imports
// This ensures window.aa exists even if there's an error during module loading
(window as any).aa =
  (window as any).aa ||
  function (...args: any[]) {
    ((window as any).aa.q = (window as any).aa.q || []).push(args);
  };

// Ensure window.aa is always an object with methods, not just a function
if (typeof (window as any).aa === 'function' && !(window as any).aa.init) {
  // Convert function to object if needed
  const queueFn = (window as any).aa;
  (window as any).aa = queueFn;
}

import { init } from './init';
import { capture } from './capture';
import { batch } from './batch';
import { dimensions } from './dimensions';

// Process queue
if ((window as any).aa.q) {
  const queue = (window as any).aa.q;
  (window as any).aa.q = [];
  queue.forEach((args: any[]) => {
    (window as any).aa(...args);
  });
}

// Export commands - Always set these, even if init fails
if (typeof window !== 'undefined') {
  try {
    (window as any).aa.init = init;
    (window as any).aa.event = function (name: string, props?: Record<string, unknown>) {
      batch.sendEvent(name, props);
    };
    (window as any).aa.dimensions = dimensions;
  } catch (e) {
    // Silently fail in production
  }
}

// Auto-initialize if script is loaded with data attributes
if (document.currentScript) {
  const script = document.currentScript as HTMLScriptElement;
  const siteId = script.getAttribute('data-site-id');
  const key = script.getAttribute('data-key');
  const endpoint = script.getAttribute('data-endpoint');

  if (siteId && key && endpoint) {
    init({ siteId, key, endpoint });
  }
}

