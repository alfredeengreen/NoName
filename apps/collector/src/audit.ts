/**
 * Audit logging utilities
 */

import { getDb } from '@analytics/db';
import { auditLog } from '@analytics/db';
import { nanoid } from 'nanoid';

export type AuditAction = 
  | 'cardinality_violation'
  | 'normalization'
  | 'event_drop'
  | 'privacy_action'
  | 'user_action';

export type AuditActionType = 
  | 'bucketed'
  | 'dropped'
  | 'mutated'
  | 'masked'
  | 'deleted';

export interface AuditLogEntry {
  siteId?: string;
  userId?: string;
  action: AuditAction;
  dimension?: string;
  valueHash?: string;
  actionType: AuditActionType;
  reason?: string;
  count?: number;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const db = getDb();
  
  try {
    await db.insert(auditLog).values({
      siteId: entry.siteId || null,
      userId: entry.userId || null,
      action: entry.action,
      dimension: entry.dimension || null,
      valueHash: entry.valueHash || null,
      actionType: entry.actionType,
      reason: entry.reason || null,
      count: entry.count || 1,
      metadata: entry.metadata || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't fail ingestion if audit logging fails
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Log cardinality violation
 */
export async function logCardinalityViolation(
  siteId: string,
  dimension: string,
  valueHash: string,
  action: 'bucketed' | 'dropped',
  count: number = 1
): Promise<void> {
  await logAuditEvent({
    siteId,
    action: 'cardinality_violation',
    dimension,
    valueHash,
    actionType: action,
    reason: 'cardinality_limit_exceeded',
    count,
    metadata: {
      dimension,
      action,
    },
  });
}

/**
 * Log normalization mutation
 */
export async function logNormalization(
  siteId: string,
  dimension: string,
  rawValue: string,
  normalizedValue: string
): Promise<void> {
  const { createHash } = await import('node:crypto');
  const valueHash = createHash('sha256').update(rawValue).digest('hex');

  await logAuditEvent({
    siteId,
    action: 'normalization',
    dimension,
    valueHash,
    actionType: 'mutated',
    reason: 'path_normalization',
    metadata: {
      rawValue: rawValue.substring(0, 100), // Truncate for storage
      normalizedValue: normalizedValue.substring(0, 100),
    },
  });
}

/**
 * Log event drop
 */
export async function logEventDrop(
  siteId: string,
  reason: 'invalid_payload' | 'cardinality' | 'rate_limit' | 'pii' | 'feature_disabled',
  count: number = 1
): Promise<void> {
  await logAuditEvent({
    siteId,
    action: 'event_drop',
    actionType: 'dropped',
    reason,
    count,
    metadata: {
      dropReason: reason,
    },
  });
}

/**
 * Log privacy action
 */
export async function logPrivacyAction(
  siteId: string,
  actionType: 'masked' | 'deleted',
  reason: string,
  count?: number
): Promise<void> {
  await logAuditEvent({
    siteId,
    action: 'privacy_action',
    actionType,
    reason,
    count,
    metadata: {
      privacyAction: actionType,
    },
  });
}
