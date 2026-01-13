-- Add published field to knowledge_chunks for Help Center visibility
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS published boolean DEFAULT true;

-- Index for filtering published articles
CREATE INDEX IF NOT EXISTS knowledge_chunks_published_idx
ON knowledge_chunks (published);

-- Comment explaining the field
COMMENT ON COLUMN knowledge_chunks.published IS 'Whether this content is visible in the public Help Center. Default true for backwards compatibility.';
