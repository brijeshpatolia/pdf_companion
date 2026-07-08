create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_messages_book_id on public.messages(book_id, created_at);

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  tokens_in integer not null,
  tokens_out integer not null,
  model text not null,
  cost_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

grant all on public.messages to anon, authenticated, service_role;
grant all on public.usage_records to anon, authenticated, service_role;
