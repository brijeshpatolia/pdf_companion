import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChunksPort, Chunk } from "../../core/ingestion/types.js";

export function supabaseChunks(client: SupabaseClient): ChunksPort {
  return {
    async upsert(bookId, chunks) {
      if (chunks.length === 0) return;

      // Clear whatever is stored for these pages first. A page can legitimately
      // hold several chunks, so there is no unique key to conflict on — and two
      // ingestion passes could briefly overlap (the reader hits Resume while a
      // pass is still running). Replacing per page keeps the result the same
      // either way.
      const pages = [...new Set(chunks.map((c) => c.page))];
      const { error: clearError } = await client
        .from("chunks")
        .delete()
        .eq("book_id", bookId)
        .in("page", pages);
      if (clearError) throw new Error(`Failed to clear chunks: ${clearError.message}`);

      const rows = chunks.map((c) => ({
        book_id: bookId,
        page: c.page,
        text: c.text,
        embedding: JSON.stringify(c.embedding),
      }));

      const { error } = await client.from("chunks").insert(rows);
      if (error) throw new Error(`Failed to insert chunks: ${error.message}`);
    },

    async embeddedPages(bookId) {
      // Selecting only `page` keeps this cheap even for a long book — the
      // embeddings themselves are never fetched.
      const { data, error } = await client.from("chunks").select("page").eq("book_id", bookId);
      if (error) throw new Error(`Failed to read ingested pages: ${error.message}`);
      return [...new Set((data ?? []).map((r: { page: number }) => r.page))];
    },
  };
}
