-- Migration 010: KB Learning Approval
-- Adds approval workflow and learning context to knowledge_chunks

-- Add new columns to knowledge_chunks
alter table knowledge_chunks
  add column if not exists approved boolean not null default true,
  add column if not exists learning_context text,
  add column if not exists source_learning_id uuid references learning_cases(id) on delete set null;

-- Index for fast pending approval queries
create index if not exists knowledge_chunks_approved_idx on knowledge_chunks (approved) where approved = false;

-- Replace match_knowledge_chunks to only return approved chunks
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_source_type text default null
)
returns table (
  id uuid,
  content text,
  source_type text,
  source_title text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    knowledge_chunks.id,
    knowledge_chunks.content,
    knowledge_chunks.source_type,
    knowledge_chunks.source_title,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where
    1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
    and (filter_source_type is null or knowledge_chunks.source_type = filter_source_type)
    and knowledge_chunks.approved = true
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
