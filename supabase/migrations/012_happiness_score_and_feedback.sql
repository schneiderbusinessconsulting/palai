-- Migration 012: Customer Happiness Score + Feedback Threads
-- =========================================================

-- 1. Add happiness_score to incoming_emails
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS happiness_score INTEGER;

-- 2. Feedback threads for Sales/Product/Marketing insights
CREATE TABLE IF NOT EXISTS feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('sales', 'product', 'marketing')),
  product TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
  ai_summary TEXT,
  problem_statement TEXT,
  ai_recommendation TEXT,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Individual feedback items extracted from emails
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES feedback_threads(id) ON DELETE CASCADE,
  email_id UUID REFERENCES incoming_emails(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  original_quote TEXT,
  department TEXT NOT NULL CHECK (department IN ('sales', 'product', 'marketing')),
  category TEXT,
  mentioned_person TEXT,
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_threads_department ON feedback_threads(department);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_status ON feedback_threads(status);
CREATE INDEX IF NOT EXISTS idx_feedback_items_thread ON feedback_items(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_email ON feedback_items(email_id);
CREATE INDEX IF NOT EXISTS idx_emails_happiness ON incoming_emails(happiness_score);

-- RLS
ALTER TABLE feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read feedback_threads" ON feedback_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write feedback_threads" ON feedback_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read feedback_items" ON feedback_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write feedback_items" ON feedback_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
