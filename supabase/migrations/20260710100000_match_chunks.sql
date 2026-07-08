create or replace function match_chunks(
  query_embedding vector(384),
  match_book_id uuid,
  max_page integer,
  match_count integer
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
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
