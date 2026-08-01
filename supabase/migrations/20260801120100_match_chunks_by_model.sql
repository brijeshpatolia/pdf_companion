-- Search only the vectors the question can actually be compared against.
--
-- A book part-way through a model change holds chunks from both models at
-- once — that is the resumable ingester working as designed, and it is a state
-- that can last for minutes on a long book, or indefinitely on a book nobody
-- has reopened yet. Without this filter the new query is scored against the
-- old vectors too, and because the two spaces are unrelated, those scores are
-- arbitrary. Arbitrary scores sort, so some of them win.
--
-- Both functions gain a required model argument rather than a defaulted one:
-- a caller that forgets it should fail loudly at the call site, not quietly
-- search a mixture.
create or replace function match_chunks(
  query_embedding vector(384),
  match_book_id uuid,
  max_page integer,
  match_count integer,
  match_model text
)
returns table (
  page integer,
  text text,
  similarity float
)
language sql stable
as $$
  select
    c.page,
    c.text,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.book_id = match_book_id
    and c.page <= max_page
    and c.embedding_model = match_model
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_chunks_all(
  query_embedding vector(384),
  match_count integer,
  match_model text
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
  where c.embedding_model = match_model
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- The old four- and two-argument forms would otherwise still resolve and
-- silently search across models.
drop function if exists match_chunks(vector(384), uuid, integer, integer);
drop function if exists match_chunks_all(vector(384), integer);
