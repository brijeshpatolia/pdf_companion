create table if not exists public.rolling_summaries (
  book_id           uuid primary key references public.books(id) on delete cascade,
  summary           text not null default '',
  covered_up_to_page integer not null default 0,
  updated_at        timestamptz not null default now()
);

grant all on public.rolling_summaries to anon, authenticated, service_role;
