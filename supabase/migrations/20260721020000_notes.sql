-- Free-form, editable notes attached to a book (optionally a page). Unlike
-- saved_items (append-only highlights/answers), notes have a full
-- create/edit/delete lifecycle, hence a table of their own.
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  page        integer check (page is null or page >= 1),
  text        text not null check (length(text) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_book_idx on public.notes (book_id, updated_at desc);

grant all on public.notes to anon, authenticated, service_role;

-- Owner-scoped RLS via the parent book (same pattern as saved_items).
alter table public.notes enable row level security;
drop policy if exists "notes_owner_all" on public.notes;
create policy "notes_owner_all" on public.notes
  for all
  using (exists (
    select 1 from public.books b where b.id = notes.book_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.books b where b.id = notes.book_id and b.owner_id = auth.uid()
  ));
