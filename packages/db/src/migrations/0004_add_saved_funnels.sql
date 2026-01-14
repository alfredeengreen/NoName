-- Add saved_funnels table for favorite funnels
CREATE TABLE IF NOT EXISTS saved_funnels (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  steps JSONB NOT NULL, -- Array of {type: 'page' | 'event', value: string, name?: string}
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_funnels_site_id ON saved_funnels(site_id);


