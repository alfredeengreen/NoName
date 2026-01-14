/**
 * Event key normalization utilities
 */

// Built-in event constants
export const EVENT_PAGEVIEW = 'pv';
export const EVENT_CLICK = 'click';
export const EVENT_FORM_SUBMIT = 'form_submit';
export const EVENT_OUTBOUND_CLICK = 'outbound_click';

/**
 * Normalize event name to valid format
 * - Lowercase
 * - Only alphanumeric, underscore, colon, hyphen
 * - Max 64 characters
 */
export function normalizeEventName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Convert to lowercase
  let normalized = name.toLowerCase().trim();

  // Remove invalid characters (keep only a-z, 0-9, _, :, -)
  normalized = normalized.replace(/[^a-z0-9_:-]/g, '');

  // Limit length
  if (normalized.length > 64) {
    normalized = normalized.substring(0, 64);
  }

  return normalized;
}

/**
 * Normalize event key (same rules as event name)
 */
export function normalizeEventKey(key: string): string {
  return normalizeEventName(key);
}

/**
 * Build event key from type and label
 */
export function buildEventKey(type: string, label: string): string {
  const normalizedType = normalizeEventName(type);
  const normalizedLabel = normalizeEventName(label);
  
  if (!normalizedLabel) {
    return normalizedType;
  }
  
  return `${normalizedType}:${normalizedLabel}`;
}


