create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  page integer not null,
  text text not null,
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create index idx_chunks_book_id on public.chunks(book_id);
create index idx_chunks_embedding on public.chunks using ivfflat (embedding vector_cosine_ops) with (lists = 10);

grant all on public.chunks to anon, authenticated, service_role;
