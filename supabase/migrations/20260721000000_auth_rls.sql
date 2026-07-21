-- Accounts & ownership: tie every book to an auth.users row and enforce
-- per-user isolation with Row-Level Security. Child tables inherit ownership
-- through their book_id. The service role (used by the trusted ingestion job)
-- bypasses RLS, so background processing is unaffected.

-- --- books: own the row via owner_id -------------------------------------

alter table public.books
  alter column owner_id set default auth.uid();

-- Link ownership to real users; removing a user removes their books.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'books_owner_id_fkey'
  ) then
    alter table public.books
      add constraint books_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- owner_id is intentionally left nullable rather than NOT NULL: legacy rows
-- (if any) stay valid but are filtered out by RLS, and the insert policy's
-- WITH CHECK already rejects a null/foreign owner on new rows.

alter table public.books enable row level security;

drop policy if exists "books_owner_all" on public.books;
create policy "books_owner_all" on public.books
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- --- child tables: own via the parent book -------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'chunks', 'messages', 'usage_records', 'reading_progress',
    'rolling_summaries', 'saved_items'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_owner_all', t);
    execute format($f$
      create policy %I on public.%I
        for all
        using (exists (
          select 1 from public.books b
          where b.id = %I.book_id and b.owner_id = auth.uid()
        ))
        with check (exists (
          select 1 from public.books b
          where b.id = %I.book_id and b.owner_id = auth.uid()
        ));
    $f$, t || '_owner_all', t, t, t);
  end loop;
end $$;

-- --- storage: PDFs live under an owner-id folder prefix ------------------
-- Path convention is `<owner_id>/<uuid>/<filename>`, so the first path
-- segment identifies the owner.

alter table storage.objects enable row level security;

drop policy if exists "pdfs_owner_read" on storage.objects;
create policy "pdfs_owner_read" on storage.objects
  for select
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pdfs_owner_insert" on storage.objects;
create policy "pdfs_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pdfs_owner_delete" on storage.objects;
create policy "pdfs_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
