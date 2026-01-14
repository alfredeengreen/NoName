-- Additional indexes for production performance optimization

-- Index for visitor ID queries (used in cohort analysis, user flows)
CREATE INDEX IF NOT EXISTS idx_events_raw_site_vid_ts ON events_raw(site_id, vid, ts DESC);

-- Index for session ID queries (used in funnel analysis, user journeys)
CREATE INDEX IF NOT EXISTS idx_events_raw_site_sid_vid ON events_raw(site_id, sid, vid);

-- Composite index for event name and time range queries
CREATE INDEX IF NOT EXISTS idx_events_raw_site_event_type_ts ON events_raw(site_id, event_type, ts DESC);

-- Index for country-based queries
CREATE INDEX IF NOT EXISTS idx_events_raw_site_country_ts ON events_raw(site_id, country, ts DESC) WHERE country IS NOT NULL;

-- Index for device category queries
CREATE INDEX IF NOT EXISTS idx_events_raw_site_device_ts ON events_raw(site_id, device_category, ts DESC) WHERE device_category IS NOT NULL;

-- Index for UTM campaign analysis
CREATE INDEX IF NOT EXISTS idx_events_raw_site_utm_campaign_ts ON events_raw(site_id, utm_campaign, ts DESC) WHERE utm_campaign IS NOT NULL;

-- Index for rollup_minute time-based queries (for dashboard performance)
CREATE INDEX IF NOT EXISTS idx_rollup_minute_site_minute_ts ON rollup_minute(site_id, minute_ts DESC);

-- Index for error events queries
CREATE INDEX IF NOT EXISTS idx_error_events_site_ts ON error_events(site_id, ts DESC);

-- Index for performance metrics queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_name ON performance_metrics(site_id, type, name, ts DESC);

-- Index for heatmap data queries
CREATE INDEX IF NOT EXISTS idx_heatmap_data_site_path_ts ON heatmap_data(site_id, path, ts DESC);

-- Index for form analytics queries
CREATE INDEX IF NOT EXISTS idx_form_analytics_site_form_ts ON form_analytics(site_id, form_id, ts DESC);

-- Index for checking session expiration (for cleanup job)
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) WHERE expires_at < NOW();

-- Index for checking events_raw retention (for cleanup job)
CREATE INDEX IF NOT EXISTS idx_events_raw_ts_cleanup ON events_raw(ts) WHERE ts < NOW() - INTERVAL '30 days';


