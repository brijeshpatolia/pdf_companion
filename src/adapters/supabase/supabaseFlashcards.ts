import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flashcard, FlashcardsPort, NewCard } from "../../core/flashcards/types.js";

interface FlashcardRow {
  id: string;
  book_id: string;
  front: string;
  back: string;
  created_at: string;
}

function toCard(r: FlashcardRow): Flashcard {
  return { id: r.id, bookId: r.book_id, front: r.front, back: r.back, createdAt: r.created_at };
}

const COLS = "id, book_id, front, back, created_at";

export function supabaseFlashcards(client: SupabaseClient): FlashcardsPort {
  return {
    async insertMany(bookId, cards: NewCard[]) {
      if (cards.length === 0) return [];
      const rows = cards.map((c) => ({ book_id: bookId, front: c.front, back: c.back }));
      const { data, error } = await client.from("flashcards").insert(rows).select(COLS);
      if (error) throw new Error(`flashcards.insertMany failed: ${error.message}`);
      return (data as FlashcardRow[]).map(toCard);
    },

    async listByBook(bookId) {
      const { data, error } = await client
        .from("flashcards")
        .select(COLS)
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`flashcards.listByBook failed: ${error.message}`);
      return (data as FlashcardRow[]).map(toCard);
    },

    async remove(id) {
      const { error } = await client.from("flashcards").delete().eq("id", id);
      if (error) throw new Error(`flashcards.remove failed: ${error.message}`);
    },
  };
}
