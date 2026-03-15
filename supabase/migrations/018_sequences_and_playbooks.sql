-- Phase 6: Sequences and Playbooks
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

-- Phase 7: Meeting slots
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_seq ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_email ON sequence_enrollments(customer_email);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_agent ON meeting_slots(agent_id);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_time ON meeting_slots(start_time);

-- RLS Policies
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on sequences" ON sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sequence_enrollments" ON sequence_enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on playbooks" ON playbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on meeting_slots" ON meeting_slots FOR ALL USING (true) WITH CHECK (true);
