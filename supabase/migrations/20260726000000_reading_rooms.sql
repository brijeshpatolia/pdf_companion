-- Live co-reading: a room is a shared session over one book.
--
-- Deliberately thin. Presence, reading position, and highlights are broadcast
-- between participants over a Realtime channel and never stored — nobody's
-- annotations end up in someone else's account, and there's no cross-user read
-- for RLS to have to permit. All this table does is make a link durable: it
-- maps an unguessable token to the book the room is about.
--
-- Copyright: the room shares the annotation layer, never the file. A joiner
-- reads their own copy; `book_title` is denormalized precisely so we can tell
-- them which book to bring without exposing the host's row.
create table if not exists public.reading_rooms (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null unique references public.books(id) on delete cascade,
  token       text not null unique check (length(token) >= 16),
  book_title  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists reading_rooms_token_idx on public.reading_rooms (token);

grant all on public.reading_rooms to anon, authenticated, service_role;

-- Owner-scoped, same pattern as shares: the host creates and revokes; joiners
-- resolve the token through the service-role client, so no public SELECT policy
-- is needed here.
alter table public.reading_rooms enable row level security;
drop policy if exists "reading_rooms_owner_all" on public.reading_rooms;
create policy "reading_rooms_owner_all" on public.reading_rooms
  for all
  using (exists (
    select 1 from public.books b where b.id = reading_rooms.book_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.books b where b.id = reading_rooms.book_id and b.owner_id = auth.uid()
  ));
