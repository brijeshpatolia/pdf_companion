-- Spend is now enforced, not just reported, so the usage ledger has to be
-- durable and owner-scoped in its own right.
--
-- Two problems with owning usage through `book_id`:
--   1. Deleting a book cascaded its usage away, so a reader could clear their
--      recorded spend — and any budget built on it — just by deleting a book.
--   2. A cross-book question that matched no passages had no book to attribute
--      to, so its cost was never recorded at all.
--
-- Give usage_records their own owner and let them outlive the book.

alter table public.usage_records
  add column if not exists owner_id uuid default auth.uid();

-- Backfill from the book each record was attributed to.
update public.usage_records u
  set owner_id = b.owner_id
  from public.books b
  where u.book_id = b.id and u.owner_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usage_records_owner_id_fkey'
  ) then
    alter table public.usage_records
      add constraint usage_records_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- The book is now just an attribution label: it may be absent (a cross-book
-- question that matched nothing) and it may go away (the book was deleted)
-- without the spend record going with it.
alter table public.usage_records alter column book_id drop not null;

alter table public.usage_records drop constraint if exists usage_records_book_id_fkey;
alter table public.usage_records
  add constraint usage_records_book_id_fkey
  foreign key (book_id) references public.books(id) on delete set null;

-- Own the row directly instead of through the book, which no longer answers
-- the question for records whose book is gone.
drop policy if exists "usage_records_owner_all" on public.usage_records;
create policy "usage_records_owner_all" on public.usage_records
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Every budget check is "this owner's spend since a cutoff".
create index if not exists idx_usage_records_owner_created
  on public.usage_records(owner_id, created_at desc);
