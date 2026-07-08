import type { SupabaseClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageTextPort } from "../../core/chat/types.js";

export function supabasePageText(client: SupabaseClient): PageTextPort {
  return {
    async getText(bookId, page) {
      const { data: book, error: bookErr } = await client
        .from("books")
        .select("file_ref")
        .eq("id", bookId)
        .single();

      if (bookErr || !book) throw new Error(`Book not found: ${bookErr?.message}`);

      const slash = (book.file_ref as string).indexOf("/");
      const bucket = (book.file_ref as string).slice(0, slash);
      const path = (book.file_ref as string).slice(slash + 1);

      const { data: fileData, error: dlErr } = await client.storage
        .from(bucket)
        .download(path);

      if (dlErr || !fileData) throw new Error(`Failed to download PDF: ${dlErr?.message}`);

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const doc = await getDocument({ data: bytes, isEvalSupported: false }).promise;

      try {
        const pdfPage = await doc.getPage(page);
        const textContent = await pdfPage.getTextContent();
        return textContent.items
          .map((item: any) => item.str ?? "")
          .join(" ");
      } finally {
        await doc.destroy();
      }
    },
  };
}
