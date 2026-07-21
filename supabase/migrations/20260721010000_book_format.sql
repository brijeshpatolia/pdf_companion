-- Books can now be PDFs or EPUBs. EPUBs are paginated into synthetic pages at
-- ingestion, so the rest of the page-based pipeline is unchanged.
alter table public.books
  add column if not exists format text not null default 'pdf'
  check (format in ('pdf', 'epub'));
