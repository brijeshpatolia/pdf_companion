-- Cross-book retrieval: nearest chunks across ALL of the caller's books, for
-- library-wide Q&A. Like match_chunks but without a single-book filter, and it
-- returns the owning book's id + title for citations.
--
-- This is a plain `stable` SQL function (not SECURITY DEFINER), so it runs with
-- the caller's privileges — RLS on `chunks` and `books` restricts results to the
-- user's own library automatically. The trusted service role bypasses RLS.
create or replace function match_chunks_all(
  query_embedding vector(384),
  match_count integer
)
returns table (
  book_id uuid,
  book_title text,
  page integer,
  text text,
  similarity float
)
language sql stable
as $$
  select
    c.book_id,
    b.title as book_title,
    c.page,
    c.text,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join books b on b.id = c.book_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
