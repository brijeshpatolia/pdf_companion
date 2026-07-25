-- Sharing: a read-only public link to one book's kept study material
-- (highlights, saved answers, notes, flashcards). At most one share per book;
-- the token is the unguessable public identifier. The public share page reads
-- through the service-role client, so no public SELECT policy is needed here —
-- owner-scoped RLS (same pattern as flashcards / notes) governs create/list/revoke.
create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null unique references public.books(id) on delete cascade,
  token       text not null unique check (length(token) >= 16),
  created_at  timestamptz not null default now()
);

create index if not exists shares_token_idx on public.shares (token);

grant all on public.shares to anon, authenticated, service_role;

alter table public.shares enable row level security;
drop policy if exists "shares_owner_all" on public.shares;
create policy "shares_owner_all" on public.shares
  for all
  using (exists (
    select 1 from public.books b where b.id = shares.book_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.books b where b.id = shares.book_id and b.owner_id = auth.uid()
  ));
