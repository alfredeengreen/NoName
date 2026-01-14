/**
 * Debug utility - gates all logging behind debug flag
 */

let debugEnabled = false;

export function setDebug(enabled: boolean) {
  debugEnabled = enabled;
}

export function debugLog(...args: any[]) {
  if (debugEnabled) console.log(...args);
}

export function debugWarn(...args: any[]) {
  if (debugEnabled) console.warn(...args);
}

export function debugError(...args: any[]) {
  if (debugEnabled) console.error(...args);
}
