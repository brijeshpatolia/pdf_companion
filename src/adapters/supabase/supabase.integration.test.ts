import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBook } from "../../core/library/createBook.js";
import { readPdfMetadata } from "../../core/library/pdfMeta.js";
import { supabaseBooks } from "./supabaseBooks.js";
import { supabaseStorage } from "./supabaseStorage.js";

// Runs only against a live local Supabase. Bring it up with `supabase start`
// (needs Docker), then export SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from its
// output. When unset, this whole suite is skipped so `npm test` stays green.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fixtureBytes = new Uint8Array(
  readFileSync(
    fileURLToPath(new URL("../../core/library/__fixtures__/three-page.pdf", import.meta.url)),
  ),
);

describe.skipIf(!url || !key)("supabase adapters (integration)", () => {
  let client: SupabaseClient;
  beforeAll(() => {
    client = createClient(url!, key!);
  });

  it("createBook stores the PDF and persists a retrievable uploaded Book", async () => {
    const book = await createBook(
      { fileBytes: fixtureBytes, filename: "socrates.pdf" },
      {
        storage: supabaseStorage(client),
        books: supabaseBooks(client),
        pdfMeta: { read: readPdfMetadata },
      },
    );

    // interface output: a real uploaded Book with metadata from the PDF
    expect(book.id).toBeTruthy();
    expect(book.status).toBe("uploaded");
    expect(book.pageCount).toBe(3);
    expect(book.title).toBe("Fixture: Three Page Book");

    // the Book row is actually persisted (adapter round-trip)
    const { data: row, error } = await client
      .from("books")
      .select()
      .eq("id", book.id)
      .single();
    expect(error).toBeNull();
    expect(row?.page_count).toBe(3);
    expect(row?.status).toBe("uploaded");

    // the raw file is actually in storage
    const slash = book.fileRef.indexOf("/");
    const bucket = book.fileRef.slice(0, slash);
    const path = book.fileRef.slice(slash + 1);
    const { data: file } = await client.storage.from(bucket).download(path);
    expect(file).toBeTruthy();
    expect((await file!.arrayBuffer()).byteLength).toBe(fixtureBytes.byteLength);
  });
});
