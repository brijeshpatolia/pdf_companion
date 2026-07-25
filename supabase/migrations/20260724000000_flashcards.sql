-- Flashcards (the "Retain" pillar): Q/A cards built from what a reader kept —
-- generated from highlights, saved answers, and notes, or added by hand.
create table if not exists public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  front       text not null check (length(front) > 0),
  back        text not null check (length(back) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists flashcards_book_idx on public.flashcards (book_id, created_at desc);

grant all on public.flashcards to anon, authenticated, service_role;

-- Owner-scoped RLS via the parent book (same pattern as saved_items / notes).
alter table public.flashcards enable row level security;
drop policy if exists "flashcards_owner_all" on public.flashcards;
create policy "flashcards_owner_all" on public.flashcards
  for all
  using (exists (
    select 1 from public.books b where b.id = flashcards.book_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.books b where b.id = flashcards.book_id and b.owner_id = auth.uid()
  ));
