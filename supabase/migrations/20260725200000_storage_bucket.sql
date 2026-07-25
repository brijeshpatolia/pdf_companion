-- The private bucket that holds uploaded / imported book files. Runtime code
-- reads and writes objects under a `<owner_id>/…` path prefix in this bucket;
-- the owner-scoped storage policies in 20260721000000_auth_rls.sql govern access.
--
-- Buckets aren't created by table DDL, so a fresh hosted project has none until
-- this runs. Idempotent, so re-applying is safe.
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;
