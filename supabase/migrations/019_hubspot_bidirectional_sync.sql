-- Migration 019: Bidirectional HubSpot Sync
-- Stores outbound HubSpot replies, conversation IDs, and provides idempotency for webhooks

-- New fields on incoming_emails for bidirectional sync
ALTER TABLE incoming_emails
  ADD COLUMN IF NOT EXISTS hubspot_reply_email_id TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_reply_text     TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_reply_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hubspot_reply_from     TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_status         TEXT,
  ADD COLUMN IF NOT EXISTS last_hubspot_sync_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_source            TEXT DEFAULT 'manual';

-- Index for fast lookup by reply email ID (dedup)
CREATE INDEX IF NOT EXISTS idx_incoming_emails_hubspot_reply_id
  ON incoming_emails(hubspot_reply_email_id)
  WHERE hubspot_reply_email_id IS NOT NULL;

-- Index for conversation ID lookups
CREATE INDEX IF NOT EXISTS idx_incoming_emails_conversation_id
  ON incoming_emails(hubspot_conversation_id)
  WHERE hubspot_conversation_id IS NOT NULL;

-- Webhook event log: prevents duplicate processing on HubSpot retries
CREATE TABLE IF NOT EXISTS hubspot_webhook_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         BIGINT NOT NULL UNIQUE,
  subscription_type TEXT NOT NULL,
  object_id        BIGINT NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL,
  processed_at     TIMESTAMPTZ DEFAULT now(),
  result           TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id
  ON hubspot_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_occurred
  ON hubspot_webhook_events(occurred_at DESC);

ALTER TABLE hubspot_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_events_service_role"
  ON hubspot_webhook_events FOR ALL TO service_role USING (true);

-- HubSpot notes (internal comments synced from HubSpot)
CREATE TABLE IF NOT EXISTS hubspot_notes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id             UUID REFERENCES incoming_emails(id) ON DELETE CASCADE,
  hubspot_note_id      TEXT NOT NULL UNIQUE,
  content              TEXT NOT NULL,
  created_by_hubspot   TEXT,
  created_at_hubspot   TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_notes_email_id
  ON hubspot_notes(email_id);

ALTER TABLE hubspot_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubspot_notes_all"
  ON hubspot_notes FOR ALL USING (true);

-- first_response_at: set automatically when an email is sent via the app
ALTER TABLE incoming_emails
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
