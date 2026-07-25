import { describe, it, expect } from "vitest";
import { supabasePageText } from "./supabasePageText.js";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ChunkRow {
  text: string;
}

/**
 * Minimal stand-in for the Supabase query builder. `storage.download` throws if
 * touched, so any test that reaches the PDF path fails loudly — that's the
 * regression we care about: an EPUB must never be handed to pdf.js.
 */
function fakeClient(opts: {
  chunks?: ChunkRow[];
  chunksError?: string;
  book?: { file_ref: string; format: string };
}): SupabaseClient {
  const chunksQuery = {
    select: () => chunksQuery,
    eq: () => chunksQuery,
    order: async () => ({
      data: opts.chunks ?? [],
      error: opts.chunksError ? { message: opts.chunksError } : null,
    }),
  };
  const booksQuery = {
    select: () => booksQuery,
    eq: () => booksQuery,
    single: async () => ({
      data: opts.book ?? null,
      error: opts.book ? null : { message: "no rows" },
    }),
  };
  return {
    from(table: string) {
      return table === "chunks" ? chunksQuery : booksQuery;
    },
    storage: {
      from() {
        return {
          download() {
            throw new Error("storage.download should not be reached");
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

describe("supabasePageText", () => {
  it("returns the page text stored at ingestion", async () => {
    const port = supabasePageText(fakeClient({ chunks: [{ text: "On the soul." }] }));
    expect(await port.getText("b1", 3)).toBe("On the soul.");
  });

  it("joins multiple chunks for the same page", async () => {
    const port = supabasePageText(fakeClient({ chunks: [{ text: "first" }, { text: "second" }] }));
    expect(await port.getText("b1", 1)).toBe("first\n\nsecond");
  });

  it("never parses an EPUB as a PDF when no chunk exists", async () => {
    // Regression: chat used to hand the .epub to pdf.js, failing every EPUB
    // book with "Invalid PDF structure".
    const port = supabasePageText(
      fakeClient({ chunks: [], book: { file_ref: "pdfs/u/x.epub", format: "epub" } }),
    );
    await expect(port.getText("b1", 3)).resolves.toBe("");
  });

  it("treats whitespace-only stored text as missing", async () => {
    const port = supabasePageText(
      fakeClient({ chunks: [{ text: "   \n " }], book: { file_ref: "pdfs/u/x.epub", format: "epub" } }),
    );
    expect(await port.getText("b1", 1)).toBe("");
  });

  it("surfaces a chunk-read failure", async () => {
    const port = supabasePageText(fakeClient({ chunksError: "boom" }));
    await expect(port.getText("b1", 1)).rejects.toThrow(/boom/);
  });

  it("reports a missing book when falling back", async () => {
    const port = supabasePageText(fakeClient({ chunks: [] }));
    await expect(port.getText("b1", 1)).rejects.toThrow(/Book not found/);
  });
});
