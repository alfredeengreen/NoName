-- Migration: Add problems, site_config, and related tables
-- This migration adds tables for problem detection, site configuration, and audit logging

-- Site Configuration
CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
  heatmap_enabled BOOLEAN NOT NULL DEFAULT false,
  replay_enabled BOOLEAN NOT NULL DEFAULT false,
  replay_masking_enabled BOOLEAN NOT NULL DEFAULT true,
  selector_mode TEXT NOT NULL DEFAULT 'lenient',
  max_distinct_event_keys_per_day INTEGER NOT NULL DEFAULT 50000,
  max_distinct_paths_per_day INTEGER NOT NULL DEFAULT 10000,
  max_distinct_dimension_values_per_key_per_day INTEGER NOT NULL DEFAULT 5000,
  max_distinct_perf_names_per_day INTEGER NOT NULL DEFAULT 20000,
  max_distinct_selectors_per_day INTEGER NOT NULL DEFAULT 50000,
  data_retention_days INTEGER NOT NULL DEFAULT 90,
  pii_masking_enabled BOOLEAN NOT NULL DEFAULT true,
  replay_sample_rate NUMERIC(3, 2) NOT NULL DEFAULT 0.1,
  allowed_query_params JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_config_site_id ON site_config(site_id);

-- Problems
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  impact_score NUMERIC(15, 2) NOT NULL,
  affected_sessions INTEGER NOT NULL DEFAULT 0,
  revenue_impact NUMERIC(15, 2),
  affected_revenue NUMERIC(15, 2),
  cost_to_fix NUMERIC(15, 2),
  status TEXT NOT NULL DEFAULT 'active',
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  predicted_severity TEXT,
  predicted_timeline TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_site_id ON problems(site_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_type ON problems(type);
CREATE INDEX IF NOT EXISTS idx_problems_severity ON problems(severity);
CREATE INDEX IF NOT EXISTS idx_problems_impact_score ON problems(impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_problems_last_seen ON problems(last_seen DESC);

-- Problem Evidence
CREATE TABLE IF NOT EXISTS problem_evidence (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  evidence_data JSONB NOT NULL,
  sample_session_ids TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_evidence_problem_id ON problem_evidence(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_evidence_site_id ON problem_evidence(site_id);

-- Correlations
CREATE TABLE IF NOT EXISTS correlations (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  correlation_type TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  dimension_value TEXT,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(15, 2) NOT NULL,
  confidence NUMERIC(5, 4),
  conversion_lift NUMERIC(10, 4),
  lift_confidence_interval_lower NUMERIC(10, 4),
  lift_confidence_interval_upper NUMERIC(10, 4),
  affected_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlations_site_id ON correlations(site_id);
CREATE INDEX IF NOT EXISTS idx_correlations_type ON correlations(correlation_type);
CREATE INDEX IF NOT EXISTS idx_correlations_dimension_key ON correlations(dimension_key);

-- Baselines
CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  baseline_value NUMERIC(15, 2) NOT NULL,
  baseline_period_days INTEGER NOT NULL,
  current_value NUMERIC(15, 2) NOT NULL,
  current_period_days INTEGER NOT NULL,
  delta NUMERIC(15, 2),
  z_score NUMERIC(10, 4),
  confidence TEXT,
  affected_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baselines_site_id ON baselines(site_id);
CREATE INDEX IF NOT EXISTS idx_baselines_metric_name ON baselines(metric_name);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  dimension TEXT,
  value_hash TEXT,
  action_type TEXT NOT NULL,
  reason TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_site_id ON audit_log(site_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
