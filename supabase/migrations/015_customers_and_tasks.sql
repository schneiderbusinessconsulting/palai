-- Customer profiles with segmentation and health scoring
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
CREATE POLICY "customer_profiles_all" ON customer_profiles FOR ALL USING (true);

-- Customer activity log
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
CREATE POLICY "customer_activities_all" ON customer_activities FOR ALL USING (true);

-- Tasks
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
CREATE POLICY "tasks_all" ON tasks FOR ALL USING (true);

-- Deals / Opportunities
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
CREATE POLICY "deals_all" ON deals FOR ALL USING (true);
