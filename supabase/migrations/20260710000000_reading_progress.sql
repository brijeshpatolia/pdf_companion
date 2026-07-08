create table if not exists public.reading_progress (
  book_id         uuid primary key references public.books(id) on delete cascade,
  current_page    integer not null default 1 check (current_page >= 1),
  furthest_read_page integer not null default 1 check (furthest_read_page >= 1),
  updated_at      timestamptz not null default now()
);

grant all on public.reading_progress to anon, authenticated, service_role;
