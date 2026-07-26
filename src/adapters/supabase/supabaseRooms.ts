import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingRoom, RoomsPort } from "../../core/rooms/types.js";

interface RoomRow {
  id: string;
  book_id: string;
  token: string;
  book_title: string;
  created_at: string;
}

function toRoom(r: RoomRow): ReadingRoom {
  return {
    id: r.id,
    bookId: r.book_id,
    token: r.token,
    bookTitle: r.book_title,
    createdAt: r.created_at,
  };
}

const COLS = "id, book_id, token, book_title, created_at";

/**
 * Host-facing calls run through the user client so RLS enforces book
 * ownership. `getByToken` is called with the service-role client when someone
 * follows a room link — they don't own the host's book, and the unguessable
 * token is what authorizes them.
 */
export function supabaseRooms(client: SupabaseClient): RoomsPort {
  return {
    async open(bookId, token, bookTitle) {
      const { data, error } = await client
        .from("reading_rooms")
        .insert({ book_id: bookId, token, book_title: bookTitle })
        .select(COLS)
        .single();
      if (error) throw new Error(`rooms.open failed: ${error.message}`);
      return toRoom(data as RoomRow);
    },

    async getByBook(bookId) {
      const { data, error } = await client
        .from("reading_rooms")
        .select(COLS)
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw new Error(`rooms.getByBook failed: ${error.message}`);
      return data ? toRoom(data as RoomRow) : null;
    },

    async getByToken(token) {
      const { data, error } = await client
        .from("reading_rooms")
        .select(COLS)
        .eq("token", token)
        .maybeSingle();
      if (error) throw new Error(`rooms.getByToken failed: ${error.message}`);
      return data ? toRoom(data as RoomRow) : null;
    },

    async close(bookId) {
      const { error } = await client.from("reading_rooms").delete().eq("book_id", bookId);
      if (error) throw new Error(`rooms.close failed: ${error.message}`);
    },
  };
}
