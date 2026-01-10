-- Add email classification columns to incoming_emails table
ALTER TABLE incoming_emails
ADD COLUMN IF NOT EXISTS email_type TEXT,
ADD COLUMN IF NOT EXISTS needs_response BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS classification_reason TEXT;

-- Add index for filtering by email_type
CREATE INDEX IF NOT EXISTS idx_incoming_emails_email_type ON incoming_emails(email_type);

-- Add ai_instructions as valid source_type for knowledge_chunks
-- (This is just documentation - the column already accepts any text)
COMMENT ON COLUMN knowledge_chunks.source_type IS 'Types: help_article, faq, course_info, email, ai_instructions';
