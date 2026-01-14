export function normalizeEventName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  let normalized = name.toLowerCase().trim();
  normalized = normalized.replace(/[^a-z0-9_:-]/g, '');
  if (normalized.length > 64) normalized = normalized.substring(0, 64);
  return normalized;
}

export function buildEventKey(type: string, label: string): string {
  const normalizedType = normalizeEventName(type);
  const normalizedLabel = normalizeEventName(label);
  if (!normalizedLabel) return normalizedType;
  return `${normalizedType}:${normalizedLabel}`;
}


