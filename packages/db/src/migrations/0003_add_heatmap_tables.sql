-- Add heatmap_data table (if not exists)
CREATE TABLE IF NOT EXISTS heatmap_data (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  type TEXT NOT NULL, -- 'click' | 'scroll' | 'move'
  x INTEGER NOT NULL, -- normalized coordinates (0-1000)
  y INTEGER NOT NULL,
  intensity INTEGER NOT NULL DEFAULT 1, -- aggregation count
  device_category TEXT,
  ts TIMESTAMP NOT NULL
);

-- Create indexes only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_heatmap_data_site_path_ts') THEN
    CREATE INDEX idx_heatmap_data_site_path_ts ON heatmap_data(site_id, path, ts DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_heatmap_data_site_path_type_ts') THEN
    CREATE INDEX idx_heatmap_data_site_path_type_ts ON heatmap_data(site_id, path, type, ts DESC);
  END IF;
END $$;

-- Add form_analytics table (if not exists, referenced by index in 0002)
CREATE TABLE IF NOT EXISTS form_analytics (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL, -- form name/identifier
  field_name TEXT,
  event_type TEXT NOT NULL, -- 'focus' | 'blur' | 'change' | 'submit' | 'abandon' | 'error'
  ts TIMESTAMP NOT NULL,
  vid TEXT NOT NULL,
  sid TEXT NOT NULL,
  time_spent INTEGER, -- seconds on field
  error_count INTEGER DEFAULT 0
);

-- Create index only if it doesn't exist (might already exist from 0002)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_form_analytics_site_form_ts') THEN
    CREATE INDEX idx_form_analytics_site_form_ts ON form_analytics(site_id, form_id, ts DESC);
  END IF;
END $$;

-- Add session_recordings table (if not exists)
CREATE TABLE IF NOT EXISTS session_recordings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  vid TEXT NOT NULL,
  sid TEXT NOT NULL,
  path TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INTEGER, -- seconds
  events JSONB,
  snapshots JSONB,
  metadata JSONB
);

-- Create indexes only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_session_recordings_site_sid') THEN
    CREATE INDEX idx_session_recordings_site_sid ON session_recordings(site_id, sid);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_session_recordings_site_start_time') THEN
    CREATE INDEX idx_session_recordings_site_start_time ON session_recordings(site_id, start_time DESC);
  END IF;
END $$;

