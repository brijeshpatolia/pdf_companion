import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note, NotesPort } from "../../core/notes/types.js";

interface NoteRow {
  id: string;
  book_id: string;
  page: number | null;
  text: string;
  created_at: string;
  updated_at: string;
}

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    bookId: r.book_id,
    page: r.page,
    text: r.text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLS = "id, book_id, page, text, created_at, updated_at";

export function supabaseNotes(client: SupabaseClient): NotesPort {
  return {
    async insert(note) {
      const { data, error } = await client
        .from("notes")
        .insert({ book_id: note.bookId, page: note.page, text: note.text })
        .select(COLS)
        .single();
      if (error) throw new Error(`notes.insert failed: ${error.message}`);
      return toNote(data as NoteRow);
    },

    async listByBook(bookId) {
      const { data, error } = await client
        .from("notes")
        .select(COLS)
        .eq("book_id", bookId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(`notes.listByBook failed: ${error.message}`);
      return (data as NoteRow[]).map(toNote);
    },

    async update(id, text) {
      const { data, error } = await client
        .from("notes")
        .update({ text, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(COLS)
        .single();
      if (error) throw new Error(`notes.update failed: ${error.message}`);
      return toNote(data as NoteRow);
    },

    async remove(id) {
      const { error } = await client.from("notes").delete().eq("id", id);
      if (error) throw new Error(`notes.remove failed: ${error.message}`);
    },
  };
}
