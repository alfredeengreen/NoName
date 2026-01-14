#!/bin/bash
# Migration script for custom_event_trackers table
# Make sure to stop your dev servers first (Ctrl+C in the terminal running 'pnpm dev')

echo "Running migration for custom_event_trackers table..."

docker exec 59e3eae42832 psql -U analytics -d analytics -c "
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
"

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
else
  echo "❌ Migration failed. Make sure:"
  echo "   1. Your dev servers are stopped (Ctrl+C in the terminal running 'pnpm dev')"
  echo "   2. Wait a few seconds for connections to close"
  echo "   3. Run this script again"
fi


