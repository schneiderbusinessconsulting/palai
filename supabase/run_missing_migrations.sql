-- =====================================================
-- SAFE COMBINED MIGRATION SCRIPT
-- Alle fehlenden Tabellen und Spalten für P Intelligence
-- SICHER: Alle Statements verwenden IF NOT EXISTS
-- Kann mehrfach ohne Fehler ausgeführt werden
-- =====================================================

-- Helper: safe policy creation (keine Fehler wenn Policy schon existiert)
-- Wir nutzen DO-Blöcke für alle CREATE POLICY statements

-- =====================================================
-- MIGRATION 006: Support Analytics, Learning, BI
-- =====================================================

-- Support Agents
CREATE TABLE IF NOT EXISTS support_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'L1',
  specializations TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  max_open_tickets INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket Escalations
CREATE TABLE IF NOT EXISTS ticket_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES support_agents(id),
  to_agent_id UUID REFERENCES support_agents(id),
  from_level TEXT NOT NULL,
  to_level TEXT NOT NULL,
  reason TEXT,
  auto_escalated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escalations_email_id ON ticket_escalations(email_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON ticket_escalations(created_at DESC);

-- Learning Cases
CREATE TABLE IF NOT EXISTS learning_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES email_drafts(id) ON DELETE SET NULL,
  original_draft TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  edit_distance FLOAT,
  difficulty_score FLOAT,
  topic_cluster TEXT,
  was_escalated BOOLEAN DEFAULT false,
  knowledge_extracted BOOLEAN DEFAULT false,
  extracted_chunk_id UUID REFERENCES knowledge_chunks(id),
  reviewed_by UUID REFERENCES support_agents(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_cases_status ON learning_cases(status);
CREATE INDEX IF NOT EXISTS idx_learning_cases_created_at ON learning_cases(created_at DESC);

-- SLA Targets
CREATE TABLE IF NOT EXISTS sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority TEXT NOT NULL,
  first_response_minutes INT NOT NULL,
  resolution_minutes INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO sla_targets (name, priority, first_response_minutes, resolution_minutes) VALUES
  ('Kritisch', 'critical', 60, 240),
  ('Hoch', 'high', 120, 480),
  ('Normal', 'normal', 480, 1440),
  ('Niedrig', 'low', 1440, 2880)
ON CONFLICT DO NOTHING;

-- CSAT Ratings
CREATE TABLE IF NOT EXISTS csat_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csat_email_id ON csat_ratings(email_id);

-- BI Insights
CREATE TABLE IF NOT EXISTS bi_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}',
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bi_insights_type ON bi_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_bi_insights_created_at ON bi_insights(created_at DESC);

-- BI Trigger Words
CREATE TABLE IF NOT EXISTS bi_trigger_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  category TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO bi_trigger_words (word, category, weight) VALUES
  ('interessiert', 'buying_signal', 1.0),
  ('anmelden', 'buying_signal', 1.5),
  ('buchen', 'buying_signal', 1.5),
  ('preis', 'buying_signal', 0.8),
  ('kosten', 'buying_signal', 0.8),
  ('ratenzahlung', 'buying_signal', 1.2),
  ('zu teuer', 'objection', 1.5),
  ('leider', 'objection', 0.5),
  ('absagen', 'churn_risk', 1.5),
  ('stornieren', 'churn_risk', 2.0),
  ('kündigen', 'churn_risk', 2.0),
  ('unzufrieden', 'churn_risk', 1.5),
  ('enttäuscht', 'churn_risk', 1.5),
  ('beschwerde', 'churn_risk', 1.5)
ON CONFLICT DO NOTHING;

-- Extend incoming_emails
ALTER TABLE incoming_emails
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS support_level TEXT DEFAULT 'L1',
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES support_agents(id),
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS topic_cluster TEXT,
  ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS sla_target_id UUID REFERENCES sla_targets(id),
  ADD COLUMN IF NOT EXISTS tone_formality TEXT,
  ADD COLUMN IF NOT EXISTS tone_sentiment TEXT,
  ADD COLUMN IF NOT EXISTS tone_urgency TEXT;

CREATE INDEX IF NOT EXISTS idx_incoming_emails_priority ON incoming_emails(priority);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_support_level ON incoming_emails(support_level);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_assigned_agent ON incoming_emails(assigned_agent_id);

-- Extend email_drafts
ALTER TABLE email_drafts
  ADD COLUMN IF NOT EXISTS was_manually_rewritten BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_distance FLOAT,
  ADD COLUMN IF NOT EXISTS learning_extracted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts(created_at DESC);

-- RLS für neue Tabellen (006)
ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE csat_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_trigger_words ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "support_agents_all" ON support_agents FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ticket_escalations_all" ON ticket_escalations FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "learning_cases_all" ON learning_cases FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sla_targets_all" ON sla_targets FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "csat_ratings_all" ON csat_ratings FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "bi_insights_all" ON bi_insights FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "bi_trigger_words_all" ON bi_trigger_words FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed Agents (idempotent)
INSERT INTO support_agents (name, email, role, is_active)
VALUES
  ('Rafael', 'rafael@palacios-relations.ch', 'L2', true),
  ('Philipp', 'philipp@palacios-relations.ch', 'L1', true)
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- =====================================================
-- MIGRATION 009: Notes, Views, Automation, Business Hours
-- =====================================================

ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_incoming_emails_tags ON incoming_emails USING GIN (tags);

ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

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
DO $$ BEGIN CREATE POLICY "email_notes_all" ON email_notes FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
DO $$ BEGIN CREATE POLICY "saved_views_all" ON saved_views FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
DO $$ BEGIN CREATE POLICY "automation_rules_all" ON automation_rules FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
DO $$ BEGIN CREATE POLICY "business_hours_all" ON business_hours FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- MIGRATION 010: KB Learning Approval
-- =====================================================

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS learning_context TEXT,
  ADD COLUMN IF NOT EXISTS source_learning_id UUID REFERENCES learning_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS knowledge_chunks_approved_idx ON knowledge_chunks (approved) WHERE approved = false;

-- Updated match_knowledge_chunks function (nur approved=true)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_source_type text DEFAULT null
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  source_title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_chunks.id,
    knowledge_chunks.content,
    knowledge_chunks.source_type,
    knowledge_chunks.source_title,
    1 - (knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE
    1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
    AND (filter_source_type IS NULL OR knowledge_chunks.source_type = filter_source_type)
    AND knowledge_chunks.approved = true
  ORDER BY knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- MIGRATION 013: Spam + Topic Tags
-- =====================================================

ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS topic_tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_incoming_emails_is_spam ON incoming_emails(is_spam);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_topic_tags ON incoming_emails USING GIN (topic_tags);

ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS star_type TEXT DEFAULT NULL;

ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS send_status TEXT DEFAULT NULL;

-- =====================================================
-- MIGRATION 015: Customers + Tasks + Deals
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  segment TEXT DEFAULT 'new',
  health_score INTEGER DEFAULT 50,
  csat_score NUMERIC(3,1),
  total_emails INTEGER DEFAULT 0,
  custom_properties JSONB DEFAULT '{}',
  first_contact TIMESTAMPTZ,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_segment ON customer_profiles(segment);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_health ON customer_profiles(health_score);
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "customer_profiles_all" ON customer_profiles FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_activities_email ON customer_activities(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_activities_created ON customer_activities(created_at DESC);
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "customer_activities_all" ON customer_activities FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  assigned_agent_id UUID,
  related_email_id UUID,
  related_customer_email TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent_id);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "tasks_all" ON tasks FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  customer_email TEXT,
  stage TEXT DEFAULT 'lead',
  value NUMERIC(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'CHF',
  probability INTEGER DEFAULT 0,
  assigned_agent_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_customer ON deals(customer_email);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "deals_all" ON deals FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- MIGRATION 018: Sequences + Playbooks + Meetings
-- =====================================================

CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES support_agents(id),
  title TEXT NOT NULL DEFAULT 'Meeting',
  customer_email TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_seq ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_email ON sequence_enrollments(customer_email);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_agent ON meeting_slots(agent_id);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_time ON meeting_slots(start_time);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_slots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "sequences_all" ON sequences FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sequence_enrollments_all" ON sequence_enrollments FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "playbooks_all" ON playbooks FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "meeting_slots_all" ON meeting_slots FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- FERTIG
-- =====================================================
SELECT 'Migration erfolgreich abgeschlossen!' AS status;
