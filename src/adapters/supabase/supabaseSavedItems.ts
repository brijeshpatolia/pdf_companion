import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedItem, SavedItemsPort } from "../../core/saved/types.js";

interface SavedItemRow {
  id: string;
  book_id: string;
  kind: SavedItem["kind"];
  page: number;
  text: string;
  question: string | null;
  created_at: string;
}

function toSavedItem(row: SavedItemRow): SavedItem {
  return {
    id: row.id,
    bookId: row.book_id,
    kind: row.kind,
    page: row.page,
    text: row.text,
    question: row.question ?? undefined,
    createdAt: row.created_at,
  };
}

export function supabaseSavedItems(client: SupabaseClient): SavedItemsPort {
  return {
    async insert(item) {
      const { data, error } = await client
        .from("saved_items")
        .insert({
          book_id: item.bookId,
          kind: item.kind,
          page: item.page,
          text: item.text,
          question: item.question ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(`saved_items.insert failed: ${error.message}`);
      return toSavedItem(data as SavedItemRow);
    },

    async listByBook(bookId) {
      const { data, error } = await client
        .from("saved_items")
        .select("id, book_id, kind, page, text, question, created_at")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`saved_items.listByBook failed: ${error.message}`);
      return (data as SavedItemRow[]).map(toSavedItem);
    },

    async remove(id) {
      const { error } = await client.from("saved_items").delete().eq("id", id);
      if (error) throw new Error(`saved_items.remove failed: ${error.message}`);
    },
  };
}
