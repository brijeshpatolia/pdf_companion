-- Which model produced each embedding.
--
-- Vectors from two different models are not comparable — they are points in
-- unrelated spaces that happen to have the same number of axes. Before this
-- column there was no way to tell them apart, so changing the embedding model
-- would have left every existing book silently unsearchable: the query would
-- embed with the new model, the stored chunks would answer with the old one,
-- and cosine similarity would return confident nonsense.
--
-- With the model recorded, "which pages are already embedded?" can mean "with
-- the model we use now", and the ingester's existing resume logic does the
-- rest: on a model change every page reads as not-yet-done, and the book
-- re-embeds through the same batched, resumable path as a fresh upload. No
-- separate backfill job.
--
-- The default names the model in use up to this migration, so existing rows
-- describe themselves truthfully rather than claiming to be whatever ships
-- next.
alter table public.chunks
  add column if not exists embedding_model text not null
  default 'Xenova/all-MiniLM-L6-v2';

-- The resume query is "pages of this book embedded by this model", so that is
-- the index it wants.
create index if not exists chunks_book_model_page_idx
  on public.chunks (book_id, embedding_model, page);
