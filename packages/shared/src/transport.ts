import { z } from 'zod';

// Common fields shared across all payload types
const CommonFieldsSchema = z.object({
  site_id: z.string().min(1).max(64),
  site_key: z.string().min(1).max(128).optional(), // Optional: included when sendBeacon is used (can't send headers)
  vid: z.string().min(1).max(64), // visitor id
  sid: z.string().min(1).max(64), // session id
  ts: z.number().int().positive(), // unix seconds
  path: z.string().max(2048),
  ref_domain: z.string().max(80).optional(),
  utm: z
    .object({
      source: z.string().max(80).optional(),
      medium: z.string().max(80).optional(),
      campaign: z.string().max(80).optional(),
      content: z.string().max(80).optional(),
      term: z.string().max(80).optional(),
    })
    .optional(),
  device: z
    .object({
      os: z.string().max(32).optional(),
      dc: z.enum(['mobile', 'tablet', 'desktop']).optional(),
      sw: z.number().int().positive().optional(), // screen width
      sh: z.number().int().positive().optional(), // screen height
      dpr: z.number().positive().optional(), // device pixel ratio
      browser: z.string().max(32).optional(),
      browserVersion: z.string().max(16).optional(),
      browserEngine: z.string().max(16).optional(),
      language: z.string().max(16).optional(),
      connectionType: z.string().max(16).optional(),
    })
    .optional(),
});

// Increment batch payload
const IncPayloadSchema = CommonFieldsSchema.extend({
  type: z.literal('inc'),
  counters: z
    .record(z.string().max(128), z.number().int().min(0).max(1000))
    .refine((obj) => Object.keys(obj).length <= 50, {
      message: 'Maximum 50 counter keys allowed',
    }),
  custom_dimensions: z.record(z.string().max(64), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

// E-commerce item
const EcommerceItemSchema = z.object({
  item_id: z.string().max(128),
  item_name: z.string().max(256).optional(),
  item_category: z.string().max(128).optional(),
  item_brand: z.string().max(128).optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
});

// Event payload
const EventPayloadSchema = CommonFieldsSchema.extend({
  type: z.literal('event'),
  name: z.string().min(1).max(64),
  props: z.record(z.string().max(64), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  value: z.number().optional(),
  currency: z.string().max(10).optional(),
  custom_dimensions: z.record(z.string().max(64), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  items: z.array(EcommerceItemSchema).optional(), // E-commerce items
});

// Session payload
const SessionPayloadSchema = CommonFieldsSchema.extend({
  type: z.literal('session'),
  start_ts: z.number().int().positive(),
  dur_s: z.number().int().min(0).max(86400), // duration in seconds, max 24 hours
  pages: z.record(z.string().max(2048), z.number().int().min(0)).optional(),
  user_properties: z.record(z.string().max(64), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  custom_dimensions: z.record(z.string().max(64), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

// Union type for all payloads
export const TransportPayloadSchema = z.discriminatedUnion('type', [
  IncPayloadSchema,
  EventPayloadSchema,
  SessionPayloadSchema,
]);

export type TransportPayload = z.infer<typeof TransportPayloadSchema>;
export type IncPayload = z.infer<typeof IncPayloadSchema>;
export type EventPayload = z.infer<typeof EventPayloadSchema>;
export type SessionPayload = z.infer<typeof SessionPayloadSchema>;

