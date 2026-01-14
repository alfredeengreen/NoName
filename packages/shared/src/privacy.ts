/**
 * Privacy utilities for PII detection and sanitization
 */

// Email regex (basic)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

// Phone regex (basic - matches common formats)
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

// SSN regex (US format)
const SSN_REGEX = /^\d{3}-?\d{2}-?\d{4}$/;

// Keys that likely contain PII
const PII_KEY_PATTERNS = ['email', 'phone', 'ssn', 'name', 'address', 'credit', 'card', 'password', 'token'];

/**
 * Check if a key or value looks like PII
 */
export function looksLikePII(key: string, value: unknown): boolean {
  // Check key name
  const keyLower = key.toLowerCase();
  if (PII_KEY_PATTERNS.some((pattern) => keyLower.includes(pattern))) {
    return true;
  }

  // Check value if it's a string
  if (typeof value === 'string') {
    const valueTrimmed = value.trim();
    
    // Check email
    if (EMAIL_REGEX.test(valueTrimmed)) {
      return true;
    }
    
    // Check phone (only if it looks like a phone number, not just digits)
    if (PHONE_REGEX.test(valueTrimmed) && valueTrimmed.length >= 10) {
      return true;
    }
    
    // Check SSN
    if (SSN_REGEX.test(valueTrimmed)) {
      return true;
    }
    
    // Check for long tokens (likely API keys, session tokens, etc.)
    if (valueTrimmed.length > 32 && /^[a-zA-Z0-9_-]+$/.test(valueTrimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize props object - remove PII, cap lengths, limit keys
 */
export function sanitizeProps(
  props: Record<string, unknown> | undefined
): { cleanProps: Record<string, string | number | boolean | null>; droppedCount: number } {
  if (!props || typeof props !== 'object') {
    return { cleanProps: {}, droppedCount: 0 };
  }

  const cleanProps: Record<string, string | number | boolean | null> = {};
  let droppedCount = 0;
  const keys = Object.keys(props);
  const maxKeys = 30;

  for (let i = 0; i < Math.min(keys.length, maxKeys); i++) {
    const key = keys[i];
    const value = props[key];

    // Skip if key is too long
    if (key.length > 64) {
      droppedCount++;
      continue;
    }

    // Check for PII
    if (looksLikePII(key, value)) {
      droppedCount++;
      continue;
    }

    // Only allow primitives
    if (value === null || value === undefined) {
      cleanProps[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      // Cap string length
      if (value.length > 128) {
        droppedCount++;
        continue;
      }
      cleanProps[key] = value;
    } else if (typeof value === 'number') {
      // Check for valid numbers (not NaN, Infinity)
      if (Number.isFinite(value)) {
        cleanProps[key] = value;
      } else {
        droppedCount++;
      }
    } else if (typeof value === 'boolean') {
      cleanProps[key] = value;
    } else {
      // Drop non-primitive values
      droppedCount++;
    }
  }

  // Count any keys beyond the limit as dropped
  if (keys.length > maxKeys) {
    droppedCount += keys.length - maxKeys;
  }

  return { cleanProps, droppedCount };
}


