-- Migration 013: Spam detection and topic tags
-- Adds spam classification and auto-topic-tagging to incoming emails

-- Spam detection fields
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;

-- Topic tags (auto-detected, separate from user tags)
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS topic_tags TEXT[] DEFAULT '{}';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_incoming_emails_is_spam ON incoming_emails(is_spam);
CREATE INDEX IF NOT EXISTS idx_incoming_emails_topic_tags ON incoming_emails USING GIN (topic_tags);

-- Additional fields for Phase 2 (inbox UX)
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE incoming_emails ADD COLUMN IF NOT EXISTS star_type TEXT DEFAULT NULL;

-- Scheduled send support
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS send_status TEXT DEFAULT NULL;
