import type { SupabaseClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageTextPort } from "../../core/chat/types.js";

/**
 * The text of one page, for grounding the companion's answer.
 *
 * Reads the text captured at ingestion (one chunk per page, for both PDF and
 * EPUB) — the same source the reader uses. This is the only thing that works
 * for EPUBs, which have no PDF to parse, and it also spares us re-downloading
 * and re-parsing an entire PDF on every single chat message.
 *
 * Parsing the source PDF is kept only as a fallback, for a PDF page that has no
 * stored chunk (e.g. a book ingested before chunk text was stored).
 */
export function supabasePageText(client: SupabaseClient): PageTextPort {
  return {
    async getText(bookId, page) {
      const { data: rows, error } = await client
        .from("chunks")
        .select("text")
        .eq("book_id", bookId)
        .eq("page", page)
        .order("id");
      if (error) throw new Error(`Failed to read page text: ${error.message}`);

      const stored = (rows ?? [])
        .map((r: { text: string }) => r.text ?? "")
        .join("\n\n")
        .trim();
      if (stored) return stored;

      const { data: book, error: bookErr } = await client
        .from("books")
        .select("file_ref, format")
        .eq("id", bookId)
        .single();
      if (bookErr || !book) throw new Error(`Book not found: ${bookErr?.message}`);

      // Only a PDF can be re-parsed from its source file. For an EPUB with no
      // stored chunk there's nothing to fall back to — return empty rather than
      // handing an EPUB to pdf.js, which fails with "Invalid PDF structure".
      if (book.format === "epub") return "";

      const fileRef = book.file_ref as string;
      const slash = fileRef.indexOf("/");
      const bucket = fileRef.slice(0, slash);
      const path = fileRef.slice(slash + 1);

      const { data: fileData, error: dlErr } = await client.storage.from(bucket).download(path);
      if (dlErr || !fileData) throw new Error(`Failed to download PDF: ${dlErr?.message}`);

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const doc = await getDocument({ data: bytes, isEvalSupported: false }).promise;

      try {
        const pdfPage = await doc.getPage(page);
        const textContent = await pdfPage.getTextContent();
        return textContent.items.map((item: any) => item.str ?? "").join(" ");
      } finally {
        await doc.destroy();
      }
    },
  };
}
