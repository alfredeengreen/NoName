-- Add saved_custom_reports table for storing user-created custom reports from natural language search

CREATE TABLE IF NOT EXISTS saved_custom_reports (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_config JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_custom_reports_site_id ON saved_custom_reports(site_id);
CREATE INDEX IF NOT EXISTS idx_saved_custom_reports_created_at ON saved_custom_reports(created_at DESC);

