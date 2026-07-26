import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSources, type Source, type StoredMessage } from "@/core/library/thread.js";

/**
 * The stored Ask-your-library conversation.
 *
 * Every call runs as the signed-in user, so row-level security decides what is
 * visible — this adapter never filters by owner itself, and must not start to:
 * a filter here would look like the security boundary without being one.
 */

/** Enough history to scroll through; beyond this the page would be unusable anyway. */
const MAX_HISTORY = 100;

export function supabaseLibraryMessages(client: SupabaseClient) {
  return {
    async load(limit = MAX_HISTORY): Promise<StoredMessage[]> {
      // Newest rows, then flipped: asking for the *last* N in time order means
      // a long history drops its oldest rows rather than its most recent.
      const { data, error } = await client
        .from("library_messages")
        .select("id, role, content, sources, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);

      return (data ?? [])
        .map((row) => ({
          id: String(row.id),
          role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(row.content ?? ""),
          sources: parseSources(row.sources),
          created_at: row.created_at ? String(row.created_at) : undefined,
        }))
        .reverse();
    },

    async append(
      role: "user" | "assistant",
      content: string,
      sources: Source[] = [],
    ): Promise<string | null> {
      const text = content.trim();
      // The table rejects empty content; an answer that streamed nothing is not
      // worth a row, and failing the whole request over it would be worse.
      if (!text) return null;

      const { data, error } = await client
        .from("library_messages")
        .insert({ role, content: text, sources })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data ? String(data.id) : null;
    },

    async clear(): Promise<void> {
      // RLS scopes the delete to this reader's rows; the predicate is only here
      // because PostgREST refuses an unfiltered delete.
      const { error } = await client
        .from("library_messages")
        .delete()
        .not("id", "is", null);
      if (error) throw new Error(error.message);
    },
  };
}
