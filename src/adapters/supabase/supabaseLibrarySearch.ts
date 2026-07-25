import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryPassage } from "../../core/library/qa.js";

export interface LibrarySearchPort {
  /** Nearest chunks across all of the caller's books (RLS-scoped). */
  searchAll(query: string, limit: number): Promise<LibraryPassage[]>;
}

export function supabaseLibrarySearch(
  client: SupabaseClient,
  embedder: (text: string) => Promise<number[]>,
): LibrarySearchPort {
  return {
    async searchAll(query, limit) {
      const queryEmbedding = await embedder(query);

      const { data, error } = await client.rpc("match_chunks_all", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: limit,
      });

      if (error) throw new Error(`library search failed: ${error.message}`);

      return (data ?? []).map((row: any) => ({
        bookId: row.book_id as string,
        bookTitle: row.book_title as string,
        page: row.page as number,
        text: row.text as string,
        score: row.similarity as number,
      }));
    },
  };
}
