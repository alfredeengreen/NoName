-- Add element_metadata table for impact analysis
CREATE TABLE IF NOT EXISTS element_metadata (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL, -- selector or ID (e.g., "#button-1", "[data-testid='submit']")
  label TEXT, -- human-readable label
  role TEXT, -- 'CTA' | 'NAV' | 'FILTER' | 'FORM' | 'OTHER'
  notes TEXT, -- optional notes
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, element_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_element_metadata_site_id ON element_metadata(site_id);
CREATE INDEX IF NOT EXISTS idx_element_metadata_element_id ON element_metadata(element_id);
CREATE INDEX IF NOT EXISTS idx_element_metadata_role ON element_metadata(role);


