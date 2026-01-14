-- Migration: Add custom_event_trackers table
-- Run this if the table doesn't exist yet

CREATE TABLE IF NOT EXISTS custom_event_trackers (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  value NUMERIC(15,2),
  css_selector TEXT NOT NULL,
  css_classes JSONB NOT NULL,
  element_tag TEXT,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_event_trackers_site_id ON custom_event_trackers(site_id);
CREATE INDEX IF NOT EXISTS idx_custom_event_trackers_enabled ON custom_event_trackers(site_id, enabled) WHERE enabled = true;


