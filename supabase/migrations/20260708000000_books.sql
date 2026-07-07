-- Reading loop core — issue #2 schema (V1-shaped from day one).
-- The books table carries future-owner fields (owner_id) even though the MVP
-- is single-user. pgvector is enabled now so the chunks table (issue #3) can
-- add embedding columns without a fresh extension migration.

create extension if not exists vector;

create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  title       text not null,
  page_count  integer not null check (page_count >= 0),
  file_ref    text not null,
  status      text not null default 'uploaded'
              check (status in ('uploaded', 'processing', 'ready', 'failed')),
  created_at  timestamptz not null default now()
);

-- Supabase roles need explicit privileges on tables this migration creates.
grant all on public.books to anon, authenticated, service_role;

-- Object-storage bucket for raw PDFs (private; recipients bring their own copy).
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;
