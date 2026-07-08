import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChunksPort, Chunk } from "../../core/ingestion/types.js";

export function supabaseChunks(client: SupabaseClient): ChunksPort {
  return {
    async upsert(bookId, chunks) {
      const rows = chunks.map((c) => ({
        book_id: bookId,
        page: c.page,
        text: c.text,
        embedding: JSON.stringify(c.embedding),
      }));

      const { error } = await client.from("chunks").insert(rows);
      if (error) throw new Error(`Failed to insert chunks: ${error.message}`);
    },

    async deleteByBook(bookId) {
      const { error } = await client.from("chunks").delete().eq("book_id", bookId);
      if (error) throw new Error(`Failed to delete chunks: ${error.message}`);
    },
  };
}
