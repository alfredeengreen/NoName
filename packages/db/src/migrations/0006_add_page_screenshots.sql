-- Add page_screenshots table for storing page screenshots for heatmap visualization

CREATE TABLE IF NOT EXISTS page_screenshots (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  screenshot_data TEXT NOT NULL,
  viewport_width INTEGER,
  viewport_height INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_screenshots_site_path ON page_screenshots(site_id, path);
CREATE INDEX IF NOT EXISTS idx_page_screenshots_site_id ON page_screenshots(site_id);
CREATE INDEX IF NOT EXISTS idx_page_screenshots_path ON page_screenshots(path);

