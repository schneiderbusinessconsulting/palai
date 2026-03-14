-- =====================================================
-- Phase 7: Email Locks for Conflict Detection
-- =====================================================
-- Prevents two agents from editing the same email simultaneously
-- =====================================================

CREATE TABLE IF NOT EXISTS email_locks (
  email_id  UUID PRIMARY KEY REFERENCES incoming_emails(id) ON DELETE CASCADE,
  locked_by TEXT        NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_locks_all" ON email_locks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_locks_locked_at ON email_locks(locked_at);

-- Comment: Locks expire after 30 minutes (enforced in application layer)
