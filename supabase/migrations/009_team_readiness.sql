-- Migration 009: Team Readiness (Tags, Notes, Views)
-- NOTE: This migration is OPTIONAL. Features degrade gracefully without it.
-- The app will use localStorage fallbacks if these tables don't exist.

-- Tags on emails (array column)
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_incoming_emails_tags ON incoming_emails USING GIN (tags);

-- Snooze support
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- Internal notes per email
CREATE TABLE IF NOT EXISTS email_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES support_agents(id),
  agent_name TEXT NOT NULL DEFAULT 'Unbekannt',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_notes_email_id ON email_notes(email_id);
ALTER TABLE email_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_notes_all" ON email_notes FOR ALL USING (true);

-- Saved inbox views
CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  agent_id UUID REFERENCES support_agents(id),
  is_global BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_views_all" ON saved_views FOR ALL USING (true);

-- Automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  run_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_all" ON automation_rules FOR ALL USING (true);

-- Business hours
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'Europe/Zurich'
);
INSERT INTO business_hours (day_of_week, start_time, end_time) VALUES
  (1,'08:00','17:00'),(2,'08:00','17:00'),(3,'08:00','17:00'),
  (4,'08:00','17:00'),(5,'08:00','17:00')
ON CONFLICT DO NOTHING;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_hours_all" ON business_hours FOR ALL USING (true);
