import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, BookFormat, BooksPort, IngestionStatus } from "../../core/library/types.js";

interface BookRow {
  id: string;
  owner_id: string | null;
  title: string;
  page_count: number;
  file_ref: string;
  status: IngestionStatus;
  format: BookFormat;
}

function rowToBook(r: BookRow): Book {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    pageCount: r.page_count,
    fileRef: r.file_ref,
    status: r.status,
    format: r.format ?? "pdf",
  };
}

/** Real BooksPort backed by Postgres (Supabase). */
export function supabaseBooks(client: SupabaseClient): BooksPort {
  return {
    async insert(book) {
      // When ownerId is null we omit the column so the DB default (auth.uid())
      // stamps the authenticated caller as owner; the RLS insert policy then
      // enforces it. An explicit ownerId is passed straight through.
      const row: Record<string, unknown> = {
        title: book.title,
        page_count: book.pageCount,
        file_ref: book.fileRef,
        status: book.status,
        format: book.format,
      };
      if (book.ownerId != null) row.owner_id = book.ownerId;

      const { data, error } = await client
        .from("books")
        .insert(row)
        .select()
        .single();
      if (error) throw new Error(`books.insert failed: ${error.message}`);
      return rowToBook(data as BookRow);
    },
  };
}
