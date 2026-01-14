/**
 * Filter configuration for analytics queries
 */
export interface FilterConfig {
  dimension: string; // path, device_category, country, os, browser_name, utm_source, etc.
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string | number | boolean | string[];
  logic?: 'AND' | 'OR'; // For multiple filters
}

/**
 * Apply filters to SQL query
 * Returns SQL WHERE clause parts and parameters
 */
export function applyFilters(
  filters: FilterConfig[],
  paramStartIndex: number = 1
): { whereClause: string; params: any[] } {
  if (!filters || filters.length === 0) {
    return { whereClause: '', params: [] };
  }

  const whereParts: string[] = [];
  const params: any[] = [];
  let paramIndex = paramStartIndex;

  filters.forEach((filter, index) => {
    const { dimension, operator, value } = filter;
    const logic = index > 0 ? (filter.logic || 'AND') : '';

    // Map dimension names to actual column names
    const columnName = mapDimensionToColumn(dimension);

    switch (operator) {
      case 'equals':
        whereParts.push(`${logic} ${columnName} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;

      case 'not_equals':
        whereParts.push(`${logic} ${columnName} != $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;

      case 'contains':
        whereParts.push(`${logic} ${columnName} ILIKE $${paramIndex}`);
        params.push(`%${value}%`);
        paramIndex++;
        break;

      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
          whereParts.push(`${logic} ${columnName} IN (${placeholders})`);
          params.push(...value);
          paramIndex += value.length;
        }
        break;

      case 'not_in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
          whereParts.push(`${logic} ${columnName} NOT IN (${placeholders})`);
          params.push(...value);
          paramIndex += value.length;
        }
        break;

      case 'gt':
        whereParts.push(`${logic} ${columnName} > $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;

      case 'gte':
        whereParts.push(`${logic} ${columnName} >= $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;

      case 'lt':
        whereParts.push(`${logic} ${columnName} < $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;

      case 'lte':
        whereParts.push(`${logic} ${columnName} <= $${paramIndex}`);
        params.push(value);
        paramIndex++;
        break;

      default:
        // Unknown operator, skip
        break;
    }
  });

  const whereClause = whereParts.length > 0 ? whereParts.join(' ') : '';
  return { whereClause, params };
}

/**
 * Map dimension names to actual database column names
 */
function mapDimensionToColumn(dimension: string): string {
  // Handle custom dimensions
  if (dimension.startsWith('custom_dimension:')) {
    // Custom dimensions are stored in JSONB, need special handling
    const dimName = dimension.replace('custom_dimension:', '');
    return `custom_dimensions->>'${dimName}'`;
  }

  // Map standard dimensions
  const dimensionMap: Record<string, string> = {
    path: 'path',
    device_category: 'device_category',
    country: 'country',
    os: 'os',
    browser_name: 'browser_name',
    browser_version: 'browser_version',
    language: 'language',
    ref_domain: 'ref_domain',
    utm_source: 'utm_source',
    utm_medium: 'utm_medium',
    utm_campaign: 'utm_campaign',
    utm_content: 'utm_content',
    utm_term: 'utm_term',
    event_name: 'event_name',
    event_type: 'event_type',
  };

  return dimensionMap[dimension] || dimension;
}

/**
 * Validate filter configuration
 */
export function validateFilter(filter: FilterConfig): { valid: boolean; error?: string } {
  if (!filter.dimension) {
    return { valid: false, error: 'Dimension is required' };
  }

  if (!filter.operator) {
    return { valid: false, error: 'Operator is required' };
  }

  if (filter.value === undefined || filter.value === null) {
    return { valid: false, error: 'Value is required' };
  }

  // Validate array operators
  if ((filter.operator === 'in' || filter.operator === 'not_in') && !Array.isArray(filter.value)) {
    return { valid: false, error: 'Value must be an array for in/not_in operators' };
  }

  // Validate numeric operators
  if (['gt', 'gte', 'lt', 'lte'].includes(filter.operator) && typeof filter.value !== 'number') {
    return { valid: false, error: 'Value must be a number for comparison operators' };
  }

  return { valid: true };
}


