import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, BooksPort, IngestionStatus } from "../../core/library/types.js";

interface BookRow {
  id: string;
  owner_id: string | null;
  title: string;
  page_count: number;
  file_ref: string;
  status: IngestionStatus;
}

function rowToBook(r: BookRow): Book {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    pageCount: r.page_count,
    fileRef: r.file_ref,
    status: r.status,
  };
}

/** Real BooksPort backed by Postgres (Supabase). */
export function supabaseBooks(client: SupabaseClient): BooksPort {
  return {
    async insert(book) {
      const { data, error } = await client
        .from("books")
        .insert({
          owner_id: book.ownerId,
          title: book.title,
          page_count: book.pageCount,
          file_ref: book.fileRef,
          status: book.status,
        })
        .select()
        .single();
      if (error) throw new Error(`books.insert failed: ${error.message}`);
      return rowToBook(data as BookRow);
    },
  };
}
