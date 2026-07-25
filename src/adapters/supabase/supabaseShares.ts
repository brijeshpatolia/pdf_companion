import type { SupabaseClient } from "@supabase/supabase-js";
import type { Share, SharesPort } from "../../core/sharing/types.js";

interface ShareRow {
  id: string;
  token: string;
  book_id: string;
  created_at: string;
}

function toShare(r: ShareRow): Share {
  return { id: r.id, token: r.token, bookId: r.book_id, createdAt: r.created_at };
}

const COLS = "id, token, book_id, created_at";

/**
 * Owner-facing calls (getByBook / create / removeByBook) run through the
 * user client so RLS enforces book ownership. `getByToken` is called with the
 * service-role client from the public share page, keyed by the unguessable token.
 */
export function supabaseShares(client: SupabaseClient): SharesPort {
  return {
    async getByBook(bookId) {
      const { data, error } = await client
        .from("shares")
        .select(COLS)
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw new Error(`shares.getByBook failed: ${error.message}`);
      return data ? toShare(data as ShareRow) : null;
    },

    async create(bookId, token) {
      const { data, error } = await client
        .from("shares")
        .insert({ book_id: bookId, token })
        .select(COLS)
        .single();
      if (error) throw new Error(`shares.create failed: ${error.message}`);
      return toShare(data as ShareRow);
    },

    async removeByBook(bookId) {
      const { error } = await client.from("shares").delete().eq("book_id", bookId);
      if (error) throw new Error(`shares.removeByBook failed: ${error.message}`);
    },

    async getByToken(token) {
      const { data, error } = await client
        .from("shares")
        .select(COLS)
        .eq("token", token)
        .maybeSingle();
      if (error) throw new Error(`shares.getByToken failed: ${error.message}`);
      return data ? toShare(data as ShareRow) : null;
    },
  };
}
