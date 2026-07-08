import type { SupabaseClient } from "@supabase/supabase-js";
import type { SummaryPort } from "../../core/summary/types.js";

export function supabaseSummary(client: SupabaseClient): SummaryPort {
  return {
    async load(bookId) {
      const { data, error } = await client
        .from("rolling_summaries")
        .select("summary, covered_up_to_page")
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw new Error(`rolling_summaries.load failed: ${error.message}`);
      if (!data) return null;
      return {
        bookId,
        summary: data.summary,
        coveredUpToPage: data.covered_up_to_page,
      };
    },

    async save(bookId, summary) {
      const { error } = await client
        .from("rolling_summaries")
        .upsert(
          {
            book_id: bookId,
            summary: summary.summary,
            covered_up_to_page: summary.coveredUpToPage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "book_id" },
        );
      if (error) throw new Error(`rolling_summaries.save failed: ${error.message}`);
    },
  };
}
