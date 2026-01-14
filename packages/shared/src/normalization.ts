/**
 * URL and selector normalization utilities
 */

export interface NormalizationConfig {
  selectorMode?: 'strict' | 'lenient';
  maxSelectorLength?: number;
  maxClassesInSelector?: number;
}

// UUID pattern: 8-4-4-4-12 hex digits
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Long hex pattern: 32+ hex characters
const LONG_HEX_PATTERN = /[0-9a-f]{32,}/gi;
// Number pattern in path segments (e.g., /users/123, /posts/456)
const PATH_NUMBER_PATTERN = /\/(\d+)(?:\/|$)/g;

/**
 * Normalize URL name by templating IDs
 * Replaces UUIDs, long hex strings, and numbers in path segments with templates
 */
export function normalizeUrlName(name: string, config?: NormalizationConfig): string {
  let normalized = name;

  // Remove query string first
  try {
    if (normalized.includes('?')) {
      normalized = normalized.split('?')[0];
    }
  } catch {
    // Ignore parsing errors
  }

  // Replace UUIDs with :uuid
  normalized = normalized.replace(UUID_PATTERN, ':uuid');

  // Replace long hex strings with :hex
  normalized = normalized.replace(LONG_HEX_PATTERN, ':hex');

  // Replace numbers in path segments with :id
  normalized = normalized.replace(PATH_NUMBER_PATTERN, '/:id$1');

  // Clean up any duplicate :id patterns
  normalized = normalized.replace(/\/:id\d+/g, '/:id');

  return normalized;
}

/**
 * Normalize CSS selector
 * Truncates/clamps selectors, reduces class noise based on mode
 */
export function normalizeSelector(
  selector: string,
  config?: NormalizationConfig
): string {
  const mode = config?.selectorMode || 'lenient';
  const maxLength = config?.maxSelectorLength || 200;
  const maxClasses = config?.maxClassesInSelector || 10;

  if (!selector || selector.length === 0) {
    return selector;
  }

  let normalized = selector;

  // In strict mode, keep only data attributes and IDs
  if (mode === 'strict') {
    // Extract data-element-id, #id, [data-testid], [data-cy]
    const dataElementId = selector.match(/\[data-element-id=['"]([^'"]+)['"]\]/i);
    const idMatch = selector.match(/#([a-zA-Z][\w-]*)/);
    const dataTestId = selector.match(/\[data-testid=['"]([^'"]+)['"]\]/i);
    const dataCy = selector.match(/\[data-cy=['"]([^'"]+)['"]\]/i);

    const parts: string[] = [];
    if (dataElementId) parts.push(`[data-element-id="${dataElementId[1]}"]`);
    if (idMatch) parts.push(`#${idMatch[1]}`);
    if (dataTestId) parts.push(`[data-testid="${dataTestId[1]}"]`);
    if (dataCy) parts.push(`[data-cy="${dataCy[1]}"]`);

    if (parts.length > 0) {
      normalized = parts.join('');
    } else {
      // If no data attributes found, keep tag name only
      const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
      normalized = tagMatch ? tagMatch[1] : selector.substring(0, 50);
    }
  } else {
    // Lenient mode: reduce class noise but keep structure
    // If selector has too many classes, keep only the first one
    const classMatches = selector.match(/\.([a-zA-Z][\w-]*)/g);
    if (classMatches && classMatches.length > maxClasses) {
      // Keep tag and first class, remove rest
      const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
      const firstClass = classMatches[0];
      normalized = tagMatch ? `${tagMatch[0]}${firstClass}` : firstClass;
    }
  }

  // Truncate if too long
  if (normalized.length > maxLength) {
    normalized = normalized.substring(0, maxLength);
  }

  return normalized;
}
