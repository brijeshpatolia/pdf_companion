import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievalPort } from "../../core/chat/context.js";

export function supabaseRetrieval(
  client: SupabaseClient,
  embedder: (text: string) => Promise<number[]>,
): RetrievalPort {
  return {
    async search(bookId, query, maxPage, limit) {
      const queryEmbedding = await embedder(query);

      const { data, error } = await client.rpc("match_chunks", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_book_id: bookId,
        max_page: maxPage,
        match_count: limit,
      });

      if (error) throw new Error(`retrieval search failed: ${error.message}`);

      return (data ?? []).map((row: any) => ({
        page: row.page as number,
        text: row.text as string,
        score: row.similarity as number,
      }));
    },
  };
}
