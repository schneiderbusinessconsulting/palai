-- Fix RLS for knowledge base search
-- Allow anon users to SELECT from knowledge_chunks (needed for chat/email search)

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Allow public select on knowledge_chunks" on knowledge_chunks;
drop policy if exists "Knowledge chunks are viewable by authenticated users" on knowledge_chunks;

-- Create new policies that allow both anon and authenticated users
create policy "Allow public select on knowledge_chunks"
  on knowledge_chunks for select
  to anon, authenticated
  using (true);

-- Also ensure insert works for the API (service role should bypass RLS, but just in case)
drop policy if exists "Allow public insert on knowledge_chunks" on knowledge_chunks;
create policy "Allow public insert on knowledge_chunks"
  on knowledge_chunks for insert
  to anon, authenticated
  with check (true);

-- Allow updates for editing
drop policy if exists "Allow public update on knowledge_chunks" on knowledge_chunks;
create policy "Allow public update on knowledge_chunks"
  on knowledge_chunks for update
  to anon, authenticated
  using (true);

-- Allow deletes
drop policy if exists "Allow public delete on knowledge_chunks" on knowledge_chunks;
create policy "Allow public delete on knowledge_chunks"
  on knowledge_chunks for delete
  to anon, authenticated
  using (true);
