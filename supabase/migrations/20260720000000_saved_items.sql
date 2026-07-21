create table if not exists public.saved_items (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  kind        text not null check (kind in ('highlight', 'answer')),
  page        integer not null check (page >= 1),
  text        text not null check (length(text) > 0),
  question    text,
  created_at  timestamptz not null default now()
);

create index if not exists saved_items_book_idx
  on public.saved_items (book_id, created_at desc);

grant all on public.saved_items to anon, authenticated, service_role;
