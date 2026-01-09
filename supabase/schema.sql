-- =====================================================
-- P Intelligence - AI Support Dashboard
-- Supabase Database Schema
-- =====================================================

-- Enable required extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- =====================================================
-- KNOWLEDGE BASE
-- =====================================================

-- Knowledge Base Chunks (für RAG)
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  source_type text not null, -- 'help_article', 'email', 'faq', 'course_info'
  source_id text, -- Referenz zur Original-Quelle (z.B. HubSpot Article ID)
  source_title text,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index für Vektorsuche
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index für Source-Type Filterung
create index if not exists knowledge_chunks_source_type_idx
  on knowledge_chunks (source_type);

-- =====================================================
-- E-MAILS & DRAFTS
-- =====================================================

-- Eingehende E-Mails
create table if not exists incoming_emails (
  id uuid primary key default gen_random_uuid(),
  hubspot_email_id text unique not null,
  hubspot_thread_id text,
  hubspot_contact_id text,
  from_email text not null,
  from_name text,
  subject text not null,
  body_text text not null,
  body_html text,
  received_at timestamp with time zone not null,
  status text default 'pending', -- 'pending', 'draft_ready', 'approved', 'sent', 'rejected'
  assigned_to uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index für Status-Filterung
create index if not exists incoming_emails_status_idx
  on incoming_emails (status);

-- Index für Chronologie
create index if not exists incoming_emails_received_at_idx
  on incoming_emails (received_at desc);

-- AI-generierte Antwortvorschläge
create table if not exists email_drafts (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references incoming_emails(id) on delete cascade,
  ai_generated_response text not null,
  edited_response text, -- Falls bearbeitet
  confidence_score float, -- 0.0 - 1.0
  relevant_chunks jsonb, -- IDs der genutzten Knowledge Chunks
  status text default 'pending', -- 'pending', 'approved', 'edited', 'rejected'
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamp with time zone,
  sent_at timestamp with time zone,
  hubspot_sent_email_id text, -- ID der gesendeten E-Mail in HubSpot
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index für Email-Draft Beziehung
create index if not exists email_drafts_email_id_idx
  on email_drafts (email_id);

-- =====================================================
-- CHAT CONVERSATIONS
-- =====================================================

-- Chat Konversationen
create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat Nachrichten
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references chat_conversations(id) on delete cascade,
  role text not null, -- 'user', 'assistant'
  content text not null,
  relevant_chunks jsonb, -- IDs der genutzten Knowledge Chunks (für assistant messages)
  created_at timestamp with time zone default now()
);

-- Index für Konversation
create index if not exists chat_messages_conversation_idx
  on chat_messages (conversation_id, created_at);

-- =====================================================
-- TEMPLATES
-- =====================================================

-- E-Mail Templates
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text default 'Allgemein',
  usage_count int default 0,
  is_favorite boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index für Kategorie
create index if not exists email_templates_category_idx
  on email_templates (category);

-- =====================================================
-- COURSES (Quick Reference)
-- =====================================================

-- Kursinformationen
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  next_start date,
  duration text,
  price decimal(10,2),
  installment_count int,
  installment_amount decimal(10,2),
  spots_available int,
  total_spots int,
  status text default 'active', -- 'active', 'full', 'inactive'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- TEAM & USERS
-- =====================================================

-- Team Members (zusätzliche Infos zu auth.users)
create table if not exists team_members (
  id uuid primary key references auth.users(id),
  display_name text not null,
  email_signature text, -- Wird an Antworten angehängt
  role text default 'member', -- 'admin', 'member'
  settings jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- =====================================================
-- AUDIT LOG
-- =====================================================

-- Audit Log für Tracking
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references incoming_emails(id),
  draft_id uuid references email_drafts(id),
  action text not null, -- 'received', 'draft_generated', 'approved', 'edited', 'sent', 'rejected'
  performed_by uuid references auth.users(id),
  details jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Index für Email/Draft Lookups
create index if not exists audit_log_email_id_idx
  on audit_log (email_id);
create index if not exists audit_log_draft_id_idx
  on audit_log (draft_id);
create index if not exists audit_log_created_at_idx
  on audit_log (created_at desc);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Funktion für Ähnlichkeitssuche in Knowledge Base
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
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Funktion um updated_at automatisch zu aktualisieren
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger für updated_at
create trigger update_knowledge_chunks_updated_at
  before update on knowledge_chunks
  for each row execute function update_updated_at_column();

create trigger update_incoming_emails_updated_at
  before update on incoming_emails
  for each row execute function update_updated_at_column();

create trigger update_email_drafts_updated_at
  before update on email_drafts
  for each row execute function update_updated_at_column();

create trigger update_email_templates_updated_at
  before update on email_templates
  for each row execute function update_updated_at_column();

create trigger update_courses_updated_at
  before update on courses
  for each row execute function update_updated_at_column();

create trigger update_team_members_updated_at
  before update on team_members
  for each row execute function update_updated_at_column();

create trigger update_chat_conversations_updated_at
  before update on chat_conversations
  for each row execute function update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
alter table knowledge_chunks enable row level security;
alter table incoming_emails enable row level security;
alter table email_drafts enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table email_templates enable row level security;
alter table courses enable row level security;
alter table team_members enable row level security;
alter table audit_log enable row level security;

-- Policies für authentifizierte Benutzer
-- Knowledge Chunks: Alle können lesen
create policy "Knowledge chunks are viewable by authenticated users"
  on knowledge_chunks for select
  to authenticated
  using (true);

-- Incoming Emails: Alle können lesen/bearbeiten
create policy "Emails are viewable by authenticated users"
  on incoming_emails for select
  to authenticated
  using (true);

create policy "Emails are editable by authenticated users"
  on incoming_emails for update
  to authenticated
  using (true);

-- Email Drafts: Alle können lesen/bearbeiten
create policy "Drafts are viewable by authenticated users"
  on email_drafts for select
  to authenticated
  using (true);

create policy "Drafts are editable by authenticated users"
  on email_drafts for all
  to authenticated
  using (true);

-- Chat: Nur eigene Konversationen
create policy "Users can view own conversations"
  on chat_conversations for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own conversations"
  on chat_conversations for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can view messages from own conversations"
  on chat_messages for select
  to authenticated
  using (
    conversation_id in (
      select id from chat_conversations where user_id = auth.uid()
    )
  );

create policy "Users can insert messages to own conversations"
  on chat_messages for insert
  to authenticated
  with check (
    conversation_id in (
      select id from chat_conversations where user_id = auth.uid()
    )
  );

-- Templates: Alle können lesen/erstellen
create policy "Templates are viewable by authenticated users"
  on email_templates for select
  to authenticated
  using (true);

create policy "Templates are creatable by authenticated users"
  on email_templates for insert
  to authenticated
  with check (true);

-- Courses: Alle können lesen
create policy "Courses are viewable by authenticated users"
  on courses for select
  to authenticated
  using (true);

-- Team Members: Alle können lesen
create policy "Team members are viewable by authenticated users"
  on team_members for select
  to authenticated
  using (true);

-- Audit Log: Alle können lesen
create policy "Audit log is viewable by authenticated users"
  on audit_log for select
  to authenticated
  using (true);

-- =====================================================
-- SEED DATA (Optional)
-- =====================================================

-- Beispiel-Kurse einfügen
insert into courses (name, description, next_start, duration, price, installment_count, installment_amount, spots_available, total_spots, status)
values
  ('Hypnose-Ausbildung', 'Umfassende Grundausbildung in klinischer Hypnose', '2026-03-15', '12 Tage (6 Monate)', 4800, 6, 850, 8, 16, 'active'),
  ('Meditation Coach', 'Zertifizierung zum professionellen Meditation Coach', '2026-04-01', '8 Tage (4 Monate)', 3600, 6, 650, 12, 20, 'active'),
  ('Life Coach Ausbildung', 'Vollständige Life Coaching Zertifizierung', '2026-05-10', '16 Tage (8 Monate)', 5400, 6, 950, 3, 14, 'active'),
  ('Stressmanagement Workshop', 'Kompakter Workshop für Stressbewältigung', '2026-02-22', '2 Tage', 890, null, null, 0, 25, 'full')
on conflict do nothing;

-- Beispiel-Templates einfügen
insert into email_templates (title, content, category, usage_count, is_favorite)
values
  ('Willkommen & Infos anfordern', 'Vielen Dank für Ihr Interesse an unseren Ausbildungen! Gerne sende ich Ihnen weitere Informationen zu...', 'Allgemein', 45, true),
  ('Ratenzahlung bestätigen', 'Ja, bei allen unseren Ausbildungen ist eine Ratenzahlung möglich. Die Standardkonditionen sind...', 'Zahlung', 32, true),
  ('Kurstermin zusenden', E'Gerne teile ich Ihnen die nächsten verfügbaren Kurstermine mit:\n\n- Hypnose-Ausbildung: [Datum]\n- Meditation Coach: [Datum]', 'Kurse', 28, false),
  ('Zertifizierung erklären', 'Unsere Ausbildungen sind vom Schweizerischen Verband für... zertifiziert und international anerkannt.', 'Zertifizierung', 21, false),
  ('Absage höflich formulieren', 'Vielen Dank für Ihre Anfrage. Leider können wir Ihnen in diesem Fall nicht weiterhelfen, da...', 'Allgemein', 15, false),
  ('Firmenbuchung anfragen', 'Für Firmenbuchungen bieten wir spezielle Konditionen an. Gerne erstelle ich Ihnen ein individuelles Angebot...', 'Firmen', 12, true)
on conflict do nothing;
