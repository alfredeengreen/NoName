import { pgTable, text, timestamp, integer, numeric, jsonb, date, boolean, bigserial, bigint, char } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { PathRule } from '@analytics/shared';

// Users
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Sessions
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Orgs
export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Org Members
export const orgMembers = pgTable('org_members', {
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'), // 'owner' | 'admin' | 'editor' | 'viewer'
  permissions: jsonb('permissions').$type<string[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Invitations
export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Sites
export const sites = pgTable('sites', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  publicSiteId: text('public_site_id').notNull().unique(),
  publicWriteKey: text('public_write_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 hash of the API key
  permissions: jsonb('permissions').$type<string[]>().notNull(), // e.g., ['read:problems', 'read:events']
  rateLimit: integer('rate_limit').notNull().default(1000), // requests per hour
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: text('created_by')
    .references(() => users.id, { onDelete: 'set null' }),
});

// Integrations
export const integrations = pgTable('integrations', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'pagerduty' | 'slack' | 'teams' | 'webhook'
  name: text('name').notNull(),
  config: jsonb('config').$type<Record<string, any>>().notNull(), // Integration-specific config
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Alert Routing Rules
export const alertRoutingRules = pgTable('alert_routing_rules', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  integrationId: text('integration_id')
    .references(() => integrations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  conditions: jsonb('conditions').$type<{
    problemType?: string[];
    severity?: string[];
    impactScoreMin?: number;
  }>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Usage Metrics
export const usageMetrics = pgTable('usage_metrics', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .references(() => sites.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  eventCount: integer('event_count').notNull().default(0),
  storageBytes: bigint('storage_bytes', { mode: 'number' }).notNull().default(0),
  apiCalls: integer('api_calls').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// IP Allowlist
export const ipAllowlist = pgTable('ip_allowlist', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  cidr: text('cidr').notNull(), // CIDR notation (e.g., "192.168.1.0/24")
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// User Audit Log
export const userAuditLog = pgTable('user_audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  orgId: text('org_id')
    .references(() => orgs.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'login' | 'logout' | 'create' | 'update' | 'delete' | 'export'
  resourceType: text('resource_type'), // 'site' | 'problem' | 'user' | 'config'
  resourceId: text('resource_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// SSO Config
export const ssoConfig = pgTable('sso_config', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' })
    .unique(),
  provider: text('provider').notNull(), // 'saml' | 'google' | 'microsoft' | 'okta'
  enabled: boolean('enabled').notNull().default(false),
  config: jsonb('config').$type<{
    entityId?: string;
    ssoUrl?: string;
    certificate?: string;
    clientId?: string;
    clientSecret?: string; // Encrypted
    [key: string]: any;
  }>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Path Rules
export const pathRules = pgTable('path_rules', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' })
    .unique(),
  rulesJson: jsonb('rules_json').$type<PathRule[]>().notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Event Definitions (governance)
export const eventDefs = pgTable('event_defs', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  propsAllowlist: jsonb('props_allowlist').$type<
    Array<{
      key: string;
      type: 'string' | 'number' | 'boolean';
      mode: 'dimension' | 'metric' | 'ignore';
      mapFrom?: string[];
    }>
  >(),
  valueRule: jsonb('value_rule').$type<{
    mode: 'none' | 'fixed' | 'prop' | 'computed';
    fixedValue?: number;
    propKey?: string;
  }>(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Events Raw (short retention)
export const eventsRaw = pgTable('events_raw', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  ts: timestamp('ts').notNull(),
  vid: text('vid').notNull(),
  sid: text('sid').notNull(),
  path: text('path').notNull(), // normalized path
  rawPath: text('raw_path'), // original path with query params
  rawSelector: text('raw_selector'), // original selector for click/frustration events
  eventType: text('event_type').notNull(), // 'inc' | 'event' | 'session'
  eventName: text('event_name'),
  refDomain: text('ref_domain'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmContent: text('utm_content'),
  utmTerm: text('utm_term'),
  country: char('country', { length: 2 }),
  deviceCategory: text('device_category'),
  os: text('os'),
  sw: integer('sw'), // screen width
  sh: integer('sh'), // screen height
  dpr: numeric('dpr', { precision: 3, scale: 2 }),
  browserName: text('browser_name'),
  browserVersion: text('browser_version'),
  browserEngine: text('browser_engine'),
  language: text('language'),
  connectionType: text('connection_type'),
  scrollDepth: integer('scroll_depth'), // max scroll depth percentage
  errorType: text('error_type'),
  errorMessage: text('error_message'), // sanitized
  searchTerm: text('search_term'), // hashed
  lcp: integer('lcp'), // Largest Contentful Paint (ms)
  fid: integer('fid'), // First Input Delay (ms)
  cls: numeric('cls', { precision: 5, scale: 3 }), // Cumulative Layout Shift
  ttfb: integer('ttfb'), // Time to First Byte (ms)
  fcp: integer('fcp'), // First Contentful Paint (ms)
  customDimensions: jsonb('custom_dimensions'), // event-scoped custom dimensions
  props: jsonb('props'),
  value: numeric('value', { precision: 15, scale: 2 }),
  currency: text('currency'),
});

// E-commerce Items
export const ecommerceItems = pgTable('ecommerce_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  eventId: bigint('event_id', { mode: 'number' })
    .notNull()
    .references(() => eventsRaw.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  itemName: text('item_name'),
  itemCategory: text('item_category'),
  itemBrand: text('item_brand'),
  quantity: integer('quantity'),
  price: numeric('price', { precision: 15, scale: 2 }),
  revenue: numeric('revenue', { precision: 15, scale: 2 }), // quantity * price
});

// Alerts
export const alerts = pgTable('alerts', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  condition: jsonb('condition').$type<{
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
    threshold: number;
    timeWindow: number; // minutes
  }>().notNull(),
  notificationChannels: jsonb('notification_channels').$type<Array<{
    type: 'email' | 'webhook';
    value: string;
  }>>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Scheduled Reports
export const scheduledReports = pgTable('scheduled_reports', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  reportType: text('report_type').notNull(), // 'overview' | 'audience' | 'acquisition' | etc.
  schedule: jsonb('schedule').$type<{
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:MM format
  }>().notNull(),
  delivery: jsonb('delivery').$type<Array<{
    type: 'email' | 'webhook';
    value: string;
  }>>().notNull(),
  format: text('format').notNull().default('pdf'), // 'pdf' | 'csv' | 'json'
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Custom Dashboards
export const dashboards = pgTable('dashboards', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  widgets: jsonb('widgets').$type<Array<{
    id: string;
    type: 'metric' | 'chart' | 'table' | 'funnel';
    config: Record<string, any>;
    position: { x: number; y: number; w: number; h: number };
  }>>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Saved Funnels (favorites)
export const savedFunnels = pgTable('saved_funnels', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  steps: jsonb('steps').$type<Array<{
    type: 'page' | 'event';
    value: string;
    name?: string;
  }>>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Saved Custom Reports
export const savedCustomReports = pgTable('saved_custom_reports', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  queryText: text('query_text').notNull(),
  queryConfig: jsonb('query_config').$type<{
    dimensions?: string[];
    metrics?: string[];
    filters?: Array<{
      dimension?: string;
      metric?: string;
      operator: string;
      value: string | number | boolean | string[];
    }>;
    visualization?: string;
    timeRange?: {
      start: string;
      end: string;
    };
  }>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Page Screenshots for Heatmaps
export const pageScreenshots = pgTable('page_screenshots', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  screenshotData: text('screenshot_data').notNull(), // base64 encoded image
  viewportWidth: integer('viewport_width'),
  viewportHeight: integer('viewport_height'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes for events_raw
// Note: Drizzle doesn't have a direct index API in schema, we'll add them in migrations

// Rollup Minute (core dashboards)
export const rollupMinute = pgTable('rollup_minute', {
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  minuteTs: timestamp('minute_ts').notNull(),
  path: text('path').notNull(),
  eventKey: text('event_key').notNull(), // e.g., 'pv', 'click:cta_signup', 'custom:signup_started'
  country: char('country', { length: 2 }),
  deviceCategory: text('device_category'),
  os: text('os'),
  refDomain: text('ref_domain'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  count: integer('count').notNull().default(0),
  valueSum: numeric('value_sum', { precision: 15, scale: 2 }),
});

// Ingest Stats
export const ingestStats = pgTable('ingest_stats', {
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  minuteTs: timestamp('minute_ts').notNull(),
  acceptedCount: integer('accepted_count').notNull().default(0),
  droppedInvalid: integer('dropped_invalid').notNull().default(0),
  droppedPii: integer('dropped_pii').notNull().default(0),
  droppedRateLimited: integer('dropped_rate_limited').notNull().default(0),
  droppedCardinality: integer('dropped_cardinality').notNull().default(0),
  lastEventTs: timestamp('last_event_ts'),
});

// Dimension Cardinality (for protection)
export const dimCardinality = pgTable('dim_cardinality', {
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  dimension: text('dimension').notNull(), // e.g., 'path', 'ref_domain', 'utm_campaign', 'prop:plan'
  valueHash: text('value_hash').notNull(), // SHA-256 hash of value
});

// Custom Dimensions
export const customDimensions = pgTable('custom_dimensions', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g., 'user_type', 'subscription_tier'
  scope: text('scope').notNull(), // 'user' | 'session' | 'event'
  dataType: text('data_type').notNull(), // 'string' | 'number' | 'boolean' | 'date'
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Calculated Metrics
export const calculatedMetrics = pgTable('calculated_metrics', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g., 'revenue_per_session', 'conversion_rate'
  formula: text('formula').notNull(), // e.g., 'revenue / sessions', 'conversions / visitors * 100'
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Segments
export const segments = pgTable('segments', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  conditions: jsonb('conditions').$type<Array<{
    dimension: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    value: string | number | boolean | string[];
    logic?: 'AND' | 'OR';
  }>>().notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Experiments (A/B Testing)
export const experiments = pgTable('experiments', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  controlVariant: text('control_variant').notNull(),
  variants: jsonb('variants').$type<string[]>().notNull(),
  storageType: text('storage_type').notNull(), // 'localStorage' | 'cookie'
  storageKey: text('storage_key').notNull(),
  goalEvent: text('goal_event').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Goals
export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'destination' | 'event' | 'duration' | 'pages_per_session'
  config: jsonb('config').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orgMembers: many(orgMembers),
}));

export const orgsRelations = relations(orgs, ({ many }) => ({
  members: many(orgMembers),
  sites: many(sites),
  invitations: many(invitations),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(orgs, {
    fields: [orgMembers.orgId],
    references: [orgs.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  org: one(orgs, {
    fields: [sites.orgId],
    references: [orgs.id],
  }),
  pathRules: one(pathRules),
  eventDefs: many(eventDefs),
  eventsRaw: many(eventsRaw),
  savedCustomReports: many(savedCustomReports),
  pageScreenshots: many(pageScreenshots),
}));

export const pathRulesRelations = relations(pathRules, ({ one }) => ({
  site: one(sites, {
    fields: [pathRules.siteId],
    references: [sites.id],
  }),
}));

export const eventDefsRelations = relations(eventDefs, ({ one }) => ({
  site: one(sites, {
    fields: [eventDefs.siteId],
    references: [sites.id],
  }),
}));

export const customDimensionsRelations = relations(customDimensions, ({ one }) => ({
  site: one(sites, {
    fields: [customDimensions.siteId],
    references: [sites.id],
  }),
}));

export const calculatedMetricsRelations = relations(calculatedMetrics, ({ one }) => ({
  site: one(sites, {
    fields: [calculatedMetrics.siteId],
    references: [sites.id],
  }),
}));

export const segmentsRelations = relations(segments, ({ one }) => ({
  site: one(sites, {
    fields: [segments.siteId],
    references: [sites.id],
  }),
}));

export const experimentsRelations = relations(experiments, ({ one }) => ({
  site: one(sites, {
    fields: [experiments.siteId],
    references: [sites.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  site: one(sites, {
    fields: [goals.siteId],
    references: [sites.id],
  }),
}));

export const savedCustomReportsRelations = relations(savedCustomReports, ({ one }) => ({
  site: one(sites, {
    fields: [savedCustomReports.siteId],
    references: [sites.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  site: one(sites, {
    fields: [alerts.siteId],
    references: [sites.id],
  }),
}));

export const scheduledReportsRelations = relations(scheduledReports, ({ one }) => ({
  site: one(sites, {
    fields: [scheduledReports.siteId],
    references: [sites.id],
  }),
}));

export const dashboardsRelations = relations(dashboards, ({ one }) => ({
  site: one(sites, {
    fields: [dashboards.siteId],
    references: [sites.id],
  }),
}));

// Errors (Sentry-style error tracking)
// Note: The actual database table has a simplified schema with id as TEXT
export const errors = pgTable('errors', {
  id: text('id').primaryKey(), // TEXT in database, not bigserial
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  fingerprint: text('fingerprint').notNull(), // for grouping
  type: text('type').notNull(), // 'js' | 'network' | 'resource' | 'promise'
  message: text('message').notNull(), // sanitized
  url: text('url'), // Optional in database
  firstSeen: timestamp('first_seen').notNull(),
  lastSeen: timestamp('last_seen').notNull(),
  count: integer('count').notNull().default(0),
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at'),
  environment: text('environment'),
  release: text('release'),
});

// Error Events (individual error occurrences)
export const errorEvents = pgTable('error_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  errorId: text('error_id') // TEXT in database, not bigint
    .notNull()
    .references(() => errors.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  vid: text('vid').notNull(),
  sid: text('sid').notNull(),
  ts: timestamp('ts').notNull(), // Field name 'ts' maps to column 'ts'
  path: text('path'),
  props: jsonb('props').$type<Record<string, any>>(),
});

// Performance Metrics
export const performanceMetrics = pgTable('performance_metrics', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'api' | 'resource' | 'navigation'
  name: text('name').notNull(), // endpoint, resource URL, or route (raw)
  normalizedName: text('normalized_name'), // templated/normalized name
  duration: integer('duration').notNull(), // milliseconds
  status: integer('status'), // HTTP status code
  size: integer('size'), // bytes
  timestamp: timestamp('ts').notNull(), // Field name 'timestamp' maps to column 'ts'
  props: jsonb('props'), // Additional metadata
});

// Heatmap Data
export const heatmapData = pgTable('heatmap_data', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  type: text('type').notNull(), // 'click' | 'scroll' | 'move'
  x: integer('x').notNull(), // normalized coordinates (0-1000)
  y: integer('y').notNull(),
  intensity: integer('intensity').notNull().default(1), // aggregation count
  deviceCategory: text('device_category'),
  ts: timestamp('ts').notNull(),
});

// Form Analytics
export const formAnalytics = pgTable('form_analytics', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  formId: text('form_id').notNull(), // form name/identifier
  fieldName: text('field_name'),
  eventType: text('event_type').notNull(), // 'focus' | 'blur' | 'change' | 'submit' | 'abandon' | 'error'
  timestamp: timestamp('ts').notNull(),
  vid: text('vid').notNull(),
  sid: text('sid').notNull(),
  timeSpent: integer('time_spent'), // seconds on field
  errorCount: integer('error_count').default(0),
});

// Session Recordings (hybrid approach)
export const sessionRecordings = pgTable('session_recordings', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  vid: text('vid').notNull(),
  sid: text('sid').notNull(),
  path: text('path').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // seconds
  masked: boolean('masked').notNull().default(true), // PII masking applied
  events: jsonb('events').$type<Array<{
    type: string;
    timestamp: number;
    data: Record<string, any>;
  }>>(),
  snapshots: jsonb('snapshots').$type<Array<{
    timestamp: number;
    html: string;
    width: number;
    height: number;
  }>>(),
  metadata: jsonb('metadata').$type<{
    device?: Record<string, any>;
    viewport?: { width: number; height: number };
    url?: string;
  }>(),
});

// Campaigns
export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  cost: numeric('cost', { precision: 15, scale: 2 }), // total campaign cost
  budget: numeric('budget', { precision: 15, scale: 2 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Custom Event Trackers
export const customEventTrackers = pgTable('custom_event_trackers', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(),
  value: numeric('value', { precision: 15, scale: 2 }), // optional numeric value
  cssSelector: text('css_selector').notNull(),
  cssClasses: jsonb('css_classes').$type<string[]>().notNull(),
  elementTag: text('element_tag'),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Element Metadata (for impact analysis)
export const elementMetadata = pgTable('element_metadata', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  elementId: text('element_id').notNull(), // selector or ID (e.g., "#button-1", "[data-testid='submit']")
  label: text('label'), // human-readable label
  role: text('role'), // 'CTA' | 'NAV' | 'FILTER' | 'FORM' | 'OTHER'
  notes: text('notes'), // optional notes
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations for errors
export const errorsRelations = relations(errors, ({ one, many }) => ({
  site: one(sites, {
    fields: [errors.siteId],
    references: [sites.id],
  }),
  events: many(errorEvents),
}));

export const errorEventsRelations = relations(errorEvents, ({ one }) => ({
  error: one(errors, {
    fields: [errorEvents.errorId],
    references: [errors.id],
  }),
}));

export const customEventTrackersRelations = relations(customEventTrackers, ({ one }) => ({
  site: one(sites, {
    fields: [customEventTrackers.siteId],
    references: [sites.id],
  }),
}));

export const elementMetadataRelations = relations(elementMetadata, ({ one }) => ({
  site: one(sites, {
    fields: [elementMetadata.siteId],
    references: [sites.id],
  }),
}));

// Site Configuration
export const siteConfig = pgTable('site_config', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' })
    .unique(),
  heatmapEnabled: boolean('heatmap_enabled').notNull().default(false),
  replayEnabled: boolean('replay_enabled').notNull().default(false),
  replayMaskingEnabled: boolean('replay_masking_enabled').notNull().default(true),
  selectorMode: text('selector_mode').notNull().default('lenient'), // 'strict' | 'lenient'
  maxDistinctEventKeysPerDay: integer('max_distinct_event_keys_per_day').notNull().default(50000),
  maxDistinctPathsPerDay: integer('max_distinct_paths_per_day').notNull().default(10000),
  maxDistinctDimensionValuesPerKeyPerDay: integer('max_distinct_dimension_values_per_key_per_day').notNull().default(5000),
  maxDistinctPerfNamesPerDay: integer('max_distinct_perf_names_per_day').notNull().default(20000),
  maxDistinctSelectorsPerDay: integer('max_distinct_selectors_per_day').notNull().default(50000),
  dataRetentionDays: integer('data_retention_days').notNull().default(90),
  piiMaskingEnabled: boolean('pii_masking_enabled').notNull().default(true),
  replaySampleRate: numeric('replay_sample_rate', { precision: 3, scale: 2 }).notNull().default('0.1'),
  allowedQueryParams: jsonb('allowed_query_params').$type<string[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Problems
export const problems = pgTable('problems', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'error_spike' | 'perf_slowdown' | 'funnel_drop' | 'ux_friction' | 'form_abandonment'
  severity: text('severity').notNull(), // 'high' | 'medium' | 'low'
  title: text('title').notNull(),
  description: text('description'),
  impactScore: numeric('impact_score', { precision: 15, scale: 2 }).notNull(),
  affectedSessions: integer('affected_sessions').notNull().default(0),
  revenueImpact: numeric('revenue_impact', { precision: 15, scale: 2 }), // estimated revenue loss
  affectedRevenue: numeric('affected_revenue', { precision: 15, scale: 2 }), // actual affected revenue
  costToFix: numeric('cost_to_fix', { precision: 15, scale: 2 }), // estimated cost to fix
  status: text('status').notNull().default('active'), // 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  firstSeen: timestamp('first_seen').notNull().defaultNow(),
  lastSeen: timestamp('last_seen').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  predictedSeverity: text('predicted_severity'), // 'high' | 'medium' | 'low'
  predictedTimeline: text('predicted_timeline'), // e.g., "3 days"
  metadata: jsonb('metadata').$type<Record<string, any>>(), // Additional problem-specific data
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Problem Evidence
export const problemEvidence = pgTable('problem_evidence', {
  id: text('id').primaryKey(),
  problemId: text('problem_id')
    .notNull()
    .references(() => problems.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  evidenceType: text('evidence_type').notNull(), // 'count' | 'baseline' | 'trend' | 'sample_sessions' | 'correlation'
  evidenceData: jsonb('evidence_data').$type<Record<string, any>>().notNull(),
  sampleSessionIds: jsonb('sample_session_ids').$type<string[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Correlations
export const correlations = pgTable('correlations', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  correlationType: text('correlation_type').notNull(), // 'error_impact' | 'perf_impact' | 'frustration_impact'
  metric1: text('metric1').notNull(), // e.g., 'error_count', 'api_duration'
  metric2: text('metric2').notNull(), // e.g., 'conversion_rate', 'exit_rate'
  correlationValue: numeric('correlation_value', { precision: 5, scale: 3 }), // -1 to 1
  pValue: numeric('p_value', { precision: 10, scale: 8 }), // statistical significance
  affectedSessions: integer('affected_sessions').notNull().default(0),
  conversionRateWith: numeric('conversion_rate_with', { precision: 5, scale: 2 }), // conversion rate with the issue
  conversionRateWithout: numeric('conversion_rate_without', { precision: 5, scale: 2 }), // conversion rate without
  causalRelationship: text('causal_relationship'), // 'causes' | 'affected_by' | 'correlated'
  relatedProblemIds: jsonb('related_problem_ids').$type<string[]>(),
  metadata: jsonb('metadata').$type<{
    lift?: number; // conversion lift in percentage points
    liftPercent?: number; // percentage change
    confidenceInterval?: { lower: number; upper: number };
    significant?: boolean;
    rateAInterval?: { lower: number; upper: number };
    rateBInterval?: { lower: number; upper: number };
  }>(),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueSiteCorrelation: sql`UNIQUE(${table.siteId}, ${table.correlationType}, ${table.metric1}, ${table.metric2})`,
}));

// Baselines
export const baselines = pgTable('baselines', {
  id: text('id').primaryKey(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  metricName: text('metric_name').notNull(), // e.g., 'conversion_rate', 'error_count', 'api_p95'
  metricType: text('metric_type').notNull(), // 'funnel' | 'event' | 'performance' | 'error'
  baselineValue: numeric('baseline_value', { precision: 15, scale: 2 }).notNull(),
  baselinePeriodDays: integer('baseline_period_days').notNull().default(7),
  currentValue: numeric('current_value', { precision: 15, scale: 2 }).notNull(),
  currentPeriodDays: integer('current_period_days').notNull().default(1),
  delta: numeric('delta', { precision: 15, scale: 2 }).notNull(), // current - baseline
  deltaPercent: numeric('delta_percent', { precision: 10, scale: 2 }), // percentage change
  zScore: numeric('z_score', { precision: 10, scale: 4 }), // statistical confidence
  confidence: text('confidence'), // 'high' | 'medium' | 'low'
  computedAt: timestamp('computed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Audit Log
export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: text('site_id')
    .references(() => sites.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'cardinality_violation' | 'normalization' | 'event_drop' | 'privacy_action' | 'user_action'
  dimension: text('dimension'), // e.g., 'path', 'event_key', 'selector'
  valueHash: text('value_hash'), // SHA-256 hash of value
  actionType: text('action_type').notNull(), // 'bucketed' | 'dropped' | 'mutated' | 'masked' | 'deleted'
  reason: text('reason'), // e.g., 'cardinality_limit_exceeded', 'invalid_payload', 'pii_detected'
  count: integer('count').default(1),
  metadata: jsonb('metadata').$type<Record<string, any>>(), // Additional context
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations for new tables
export const siteConfigRelations = relations(siteConfig, ({ one }) => ({
  site: one(sites, {
    fields: [siteConfig.siteId],
    references: [sites.id],
  }),
}));

export const problemsRelations = relations(problems, ({ one, many }) => ({
  site: one(sites, {
    fields: [problems.siteId],
    references: [sites.id],
  }),
  evidence: many(problemEvidence),
}));

export const problemEvidenceRelations = relations(problemEvidence, ({ one }) => ({
  problem: one(problems, {
    fields: [problemEvidence.problemId],
    references: [problems.id],
  }),
  site: one(sites, {
    fields: [problemEvidence.siteId],
    references: [sites.id],
  }),
}));

export const correlationsRelations = relations(correlations, ({ one }) => ({
  site: one(sites, {
    fields: [correlations.siteId],
    references: [sites.id],
  }),
}));

export const baselinesRelations = relations(baselines, ({ one }) => ({
  site: one(sites, {
    fields: [baselines.siteId],
    references: [sites.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  site: one(sites, {
    fields: [auditLog.siteId],
    references: [sites.id],
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

// Relations for new tables
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  org: one(orgs, {
    fields: [apiKeys.orgId],
    references: [orgs.id],
  }),
  creator: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  org: one(orgs, {
    fields: [integrations.orgId],
    references: [orgs.id],
  }),
  routingRules: many(alertRoutingRules),
}));

export const alertRoutingRulesRelations = relations(alertRoutingRules, ({ one }) => ({
  org: one(orgs, {
    fields: [alertRoutingRules.orgId],
    references: [orgs.id],
  }),
  integration: one(integrations, {
    fields: [alertRoutingRules.integrationId],
    references: [integrations.id],
  }),
}));

export const usageMetricsRelations = relations(usageMetrics, ({ one }) => ({
  org: one(orgs, {
    fields: [usageMetrics.orgId],
    references: [orgs.id],
  }),
  site: one(sites, {
    fields: [usageMetrics.siteId],
    references: [sites.id],
  }),
}));

export const ipAllowlistRelations = relations(ipAllowlist, ({ one }) => ({
  org: one(orgs, {
    fields: [ipAllowlist.orgId],
    references: [orgs.id],
  }),
}));

export const userAuditLogRelations = relations(userAuditLog, ({ one }) => ({
  user: one(users, {
    fields: [userAuditLog.userId],
    references: [users.id],
  }),
  org: one(orgs, {
    fields: [userAuditLog.orgId],
    references: [orgs.id],
  }),
}));

export const ssoConfigRelations = relations(ssoConfig, ({ one }) => ({
  org: one(orgs, {
    fields: [ssoConfig.orgId],
    references: [orgs.id],
  }),
}));

