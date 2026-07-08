import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestBooksPort } from "../../core/ingestion/types.js";

export function supabaseIngestBooks(client: SupabaseClient): IngestBooksPort {
  return {
    async getFileRef(bookId) {
      const { data, error } = await client
        .from("books")
        .select("file_ref")
        .eq("id", bookId)
        .single();

      if (error || !data) throw new Error(`Book not found: ${error?.message}`);
      return data.file_ref as string;
    },

    async updateStatus(bookId, status) {
      const { error } = await client
        .from("books")
        .update({ status })
        .eq("id", bookId);

      if (error) throw new Error(`Failed to update book status: ${error.message}`);
    },
  };
}
