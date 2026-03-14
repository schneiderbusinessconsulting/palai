-- Migration 008: Buying Intent Score + App Config Table

-- 1. Add buying_intent_score to incoming_emails
ALTER TABLE incoming_emails
  ADD COLUMN IF NOT EXISTS buying_intent_score INTEGER DEFAULT 0;

-- 2. Create app_config table for persistent settings
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Policy: allow all authenticated users to read/write (single-tenant app)
CREATE POLICY "Allow all access to app_config" ON app_config
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default config values
INSERT INTO app_config (key, value, description)
VALUES
  ('learning_min_edit_distance', '0.1', 'Minimum edit distance to trigger learning case (0.0 - 1.0)'),
  ('rag_match_threshold', '0.5', 'Minimum similarity threshold for knowledge base search (0.0 - 1.0)'),
  ('auto_extract_days', '90', 'Number of days back to scan for auto-extraction'),
  ('auto_extract_enabled', 'true', 'Whether automatic learning extraction is enabled')
ON CONFLICT (key) DO NOTHING;
