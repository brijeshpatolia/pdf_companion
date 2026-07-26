-- Questions asked across the whole library, and the answers they got.
--
-- Kept separate from `messages`, which is keyed to a single book: a library
-- question has no one book, and its answer cites several. Reusing that table
-- would have meant making book_id nullable and teaching every per-book query
-- to exclude the nulls.
--
-- The cited sources are stored *with* the answer rather than joined at read
-- time. A book can be deleted, and the answer it produced is still worth
-- keeping — it just loses its links.
create table if not exists public.library_messages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (length(content) > 0),
  sources     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists library_messages_owner_idx
  on public.library_messages (owner_id, created_at);

grant all on public.library_messages to anon, authenticated, service_role;

-- Owner-scoped directly, unlike notes and shares, which reach their owner
-- through a parent book. There is no parent here.
alter table public.library_messages enable row level security;
drop policy if exists "library_messages_owner_all" on public.library_messages;
create policy "library_messages_owner_all" on public.library_messages
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
