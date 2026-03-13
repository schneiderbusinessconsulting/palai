-- =====================================================
-- Phase 0: Support Analytics & Self-Learning Migration
-- =====================================================
-- Run in Supabase SQL Editor BEFORE deploying Phase 1+
-- =====================================================

-- 1. SUPPORT AGENTS (L1/L2 Tiered Support)
CREATE TABLE IF NOT EXISTS support_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'L1', -- 'L1', 'L2', 'admin'
  specializations TEXT[] DEFAULT '{}', -- e.g. '{hypnose,meditation,preise}'
  is_active BOOLEAN DEFAULT true,
  max_open_tickets INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TICKET ESCALATIONS
CREATE TABLE IF NOT EXISTS ticket_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES support_agents(id),
  to_agent_id UUID REFERENCES support_agents(id),
  from_level TEXT NOT NULL, -- 'L1', 'L2'
  to_level TEXT NOT NULL,
  reason TEXT,
  auto_escalated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_email_id ON ticket_escalations(email_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON ticket_escalations(created_at DESC);

-- 3. LEARNING CASES (Self-Learning from corrections)
CREATE TABLE IF NOT EXISTS learning_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES email_drafts(id) ON DELETE SET NULL,
  original_draft TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  edit_distance FLOAT, -- 0.0-1.0 (Levenshtein normalized)
  difficulty_score FLOAT, -- 0.0-1.0
  topic_cluster TEXT,
  was_escalated BOOLEAN DEFAULT false,
  knowledge_extracted BOOLEAN DEFAULT false, -- true after "Als Wissen übernehmen"
  extracted_chunk_id UUID REFERENCES knowledge_chunks(id),
  reviewed_by UUID REFERENCES support_agents(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'extracted', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_cases_status ON learning_cases(status);
CREATE INDEX IF NOT EXISTS idx_learning_cases_created_at ON learning_cases(created_at DESC);

-- 4. SLA TARGETS
CREATE TABLE IF NOT EXISTS sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority TEXT NOT NULL, -- 'critical', 'high', 'normal', 'low'
  first_response_minutes INT NOT NULL, -- e.g. 60, 240, 480
  resolution_minutes INT NOT NULL, -- e.g. 240, 1440, 2880
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default SLA targets
INSERT INTO sla_targets (name, priority, first_response_minutes, resolution_minutes) VALUES
  ('Kritisch', 'critical', 60, 240),
  ('Hoch', 'high', 120, 480),
  ('Normal', 'normal', 480, 1440),
  ('Niedrig', 'low', 1440, 2880)
ON CONFLICT DO NOTHING;

-- 5. CSAT RATINGS
CREATE TABLE IF NOT EXISTS csat_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csat_email_id ON csat_ratings(email_id);

-- 6. BI INSIGHTS
CREATE TABLE IF NOT EXISTS bi_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES incoming_emails(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL, -- 'buying_signal', 'objection', 'churn_risk', 'upsell', 'feedback'
  content TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bi_insights_type ON bi_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_bi_insights_created_at ON bi_insights(created_at DESC);

-- 7. BI TRIGGER WORDS
CREATE TABLE IF NOT EXISTS bi_trigger_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  category TEXT NOT NULL, -- 'buying_signal', 'objection', 'churn_risk'
  weight FLOAT DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert some default trigger words
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

-- =====================================================
-- EXTEND EXISTING TABLES
-- =====================================================

-- 8. EXTEND incoming_emails
ALTER TABLE incoming_emails
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'
ADD COLUMN IF NOT EXISTS support_level TEXT DEFAULT 'L1', -- 'L1', 'L2'
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES support_agents(id),
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS topic_cluster TEXT,
ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'ok', -- 'ok', 'at_risk', 'breached'
ADD COLUMN IF NOT EXISTS sla_target_id UUID REFERENCES sla_targets(id),
ADD COLUMN IF NOT EXISTS tone_formality TEXT, -- 'formal', 'informal'
ADD COLUMN IF NOT EXISTS tone_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'frustrated'
ADD COLUMN IF NOT EXISTS tone_urgency TEXT; -- 'low', 'medium', 'high', 'critical'

CREATE INDEX IF NOT EXISTS idx_incoming_emails_priority ON incoming_emails(priority);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_support_level ON incoming_emails(support_level);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_assigned_agent ON incoming_emails(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_received_at ON incoming_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_status ON incoming_emails(status);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_topic ON incoming_emails(topic_cluster);

-- 9. EXTEND email_drafts
ALTER TABLE email_drafts
ADD COLUMN IF NOT EXISTS was_manually_rewritten BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS edit_distance FLOAT, -- 0.0-1.0
ADD COLUMN IF NOT EXISTS learning_extracted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_confidence ON email_drafts(confidence_score);

-- =====================================================
-- ANALYTICS FUNCTIONS (used by /api/analytics)
-- =====================================================

-- Function: Get analytics summary for a date range
CREATE OR REPLACE FUNCTION get_analytics_summary(
  start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'period', json_build_object(
      'start', start_date,
      'end', end_date,
      'days', (end_date - start_date + 1)
    ),
    'emails', (
      SELECT json_build_object(
        'total', COUNT(*),
        'sent', COUNT(*) FILTER (WHERE status = 'sent'),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'draft_ready', COUNT(*) FILTER (WHERE status = 'draft_ready'),
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
        'customer_inquiries', COUNT(*) FILTER (WHERE email_type = 'customer_inquiry'),
        'form_submissions', COUNT(*) FILTER (WHERE email_type = 'form_submission'),
        'system_mails', COUNT(*) FILTER (WHERE email_type IN ('system_alert', 'notification')),
        'needs_response', COUNT(*) FILTER (WHERE needs_response = true)
      )
      FROM incoming_emails
      WHERE received_at::DATE BETWEEN start_date AND end_date
    ),
    'drafts', (
      SELECT json_build_object(
        'total', COUNT(*),
        'approved', COUNT(*) FILTER (WHERE d.status = 'approved'),
        'edited', COUNT(*) FILTER (WHERE d.status = 'edited'),
        'rejected', COUNT(*) FILTER (WHERE d.status = 'rejected'),
        'avg_confidence', COALESCE(ROUND(AVG(d.confidence_score)::NUMERIC, 2), 0),
        'high_confidence', COUNT(*) FILTER (WHERE d.confidence_score >= 0.85),
        'medium_confidence', COUNT(*) FILTER (WHERE d.confidence_score >= 0.7 AND d.confidence_score < 0.85),
        'low_confidence', COUNT(*) FILTER (WHERE d.confidence_score < 0.7)
      )
      FROM email_drafts d
      JOIN incoming_emails e ON d.email_id = e.id
      WHERE e.received_at::DATE BETWEEN start_date AND end_date
    ),
    'response_times', (
      SELECT json_build_object(
        'avg_first_response_minutes', COALESCE(
          ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - received_at)) / 60)::NUMERIC, 0),
          0
        ),
        'avg_resolution_minutes', COALESCE(
          ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - received_at)) / 60)::NUMERIC, 0),
          0
        )
      )
      FROM incoming_emails
      WHERE received_at::DATE BETWEEN start_date AND end_date
        AND first_response_at IS NOT NULL
    ),
    'sla', (
      SELECT json_build_object(
        'ok', COUNT(*) FILTER (WHERE sla_status = 'ok'),
        'at_risk', COUNT(*) FILTER (WHERE sla_status = 'at_risk'),
        'breached', COUNT(*) FILTER (WHERE sla_status = 'breached')
      )
      FROM incoming_emails
      WHERE received_at::DATE BETWEEN start_date AND end_date
        AND sla_status IS NOT NULL
    ),
    'daily', (
      SELECT COALESCE(json_agg(day_data ORDER BY day_data->>'day'), '[]'::JSON)
      FROM (
        SELECT json_build_object(
          'day', DATE(received_at),
          'total', COUNT(*),
          'sent', COUNT(*) FILTER (WHERE status = 'sent'),
          'pending', COUNT(*) FILTER (WHERE status = 'pending'),
          'customer_inquiries', COUNT(*) FILTER (WHERE email_type = 'customer_inquiry'),
          'system_mails', COUNT(*) FILTER (WHERE email_type IN ('system_alert', 'notification'))
        ) AS day_data
        FROM incoming_emails
        WHERE received_at::DATE BETWEEN start_date AND end_date
        GROUP BY DATE(received_at)
      ) daily_stats
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function: Get top senders
CREATE OR REPLACE FUNCTION get_top_senders(
  start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  end_date DATE DEFAULT CURRENT_DATE,
  sender_limit INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(t), '[]'::JSON) INTO result
  FROM (
    SELECT
      COALESCE(from_name, from_email) AS sender,
      from_email AS email,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE status = 'sent') AS answered,
      COUNT(*) FILTER (WHERE status = 'pending' OR status = 'draft_ready') AS open
    FROM incoming_emails
    WHERE received_at::DATE BETWEEN start_date AND end_date
      AND email_type IS DISTINCT FROM 'system_alert'
      AND email_type IS DISTINCT FROM 'notification'
    GROUP BY COALESCE(from_name, from_email), from_email
    ORDER BY count DESC
    LIMIT sender_limit
  ) t;

  RETURN result;
END;
$$;

-- Function: Get topic distribution
CREATE OR REPLACE FUNCTION get_topic_distribution(
  start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  end_date DATE DEFAULT CURRENT_DATE,
  topic_limit INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(t), '[]'::JSON) INTO result
  FROM (
    SELECT
      COALESCE(
        topic_cluster,
        CASE
          WHEN subject ILIKE '%hypnose%' THEN 'Hypnose-Ausbildung'
          WHEN subject ILIKE '%meditation%' THEN 'Meditation'
          WHEN subject ILIKE '%coach%' OR subject ILIKE '%life%' THEN 'Life Coaching'
          WHEN subject ILIKE '%preis%' OR subject ILIKE '%kosten%' OR subject ILIKE '%rate%' OR subject ILIKE '%zahlung%' THEN 'Preise & Zahlung'
          WHEN subject ILIKE '%termin%' OR subject ILIKE '%datum%' OR subject ILIKE '%wann%' OR subject ILIKE '%start%' THEN 'Termine & Daten'
          WHEN subject ILIKE '%zertifik%' OR subject ILIKE '%diplom%' OR subject ILIKE '%abschluss%' THEN 'Zertifizierung'
          WHEN subject ILIKE '%anmeld%' OR subject ILIKE '%registr%' OR subject ILIKE '%buchung%' THEN 'Anmeldung'
          WHEN subject ILIKE '%formular%' OR subject ILIKE '%kontakt%' THEN 'Kontaktformular'
          ELSE 'Sonstiges'
        END
      ) AS topic,
      COUNT(*) AS count
    FROM incoming_emails
    WHERE received_at::DATE BETWEEN start_date AND end_date
      AND email_type IS DISTINCT FROM 'system_alert'
      AND email_type IS DISTINCT FROM 'notification'
    GROUP BY topic
    ORDER BY count DESC
    LIMIT topic_limit
  ) t;

  RETURN result;
END;
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE csat_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_trigger_words ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (dashboard is internal)
CREATE POLICY "Allow authenticated read" ON support_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON ticket_escalations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON learning_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON sla_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON csat_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON bi_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON bi_trigger_words FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert/update (internal tool)
CREATE POLICY "Allow authenticated write" ON support_agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON support_agents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated write" ON ticket_escalations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated write" ON learning_cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON learning_cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated write" ON csat_ratings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated write" ON bi_insights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated write" ON bi_trigger_words FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON bi_trigger_words FOR UPDATE TO authenticated USING (true);

-- CSAT ratings should also be insertable by anon (public rating page)
CREATE POLICY "Allow anon insert" ON csat_ratings FOR INSERT TO anon WITH CHECK (true);

-- Allow service role full access (for API routes)
CREATE POLICY "Allow service role full access" ON support_agents FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ticket_escalations FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON learning_cases FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON sla_targets FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON csat_ratings FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON bi_insights FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON bi_trigger_words FOR ALL TO service_role USING (true);
