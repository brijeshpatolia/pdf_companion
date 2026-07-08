import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingProgress, ReadingProgressPort } from "../../core/progress/types.js";

export function supabaseProgress(client: SupabaseClient): ReadingProgressPort {
  return {
    async load(bookId) {
      const { data, error } = await client
        .from("reading_progress")
        .select("current_page, furthest_read_page")
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw new Error(`reading_progress.load failed: ${error.message}`);
      if (!data) return null;
      return {
        bookId,
        currentPage: data.current_page,
        furthestReadPage: data.furthest_read_page,
      };
    },

    async save(bookId, progress) {
      const { error } = await client
        .from("reading_progress")
        .upsert(
          {
            book_id: bookId,
            current_page: progress.currentPage,
            furthest_read_page: progress.furthestReadPage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "book_id" },
        );
      if (error) throw new Error(`reading_progress.save failed: ${error.message}`);
    },
  };
}
