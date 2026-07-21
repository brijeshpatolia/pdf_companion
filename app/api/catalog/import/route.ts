import { NextResponse } from "next/server";
import { getCatalogBook, gutenbergEpubUrl, CATALOG_SOURCE } from "@/core/catalog/catalog.js";
import { downloadEpubBytes } from "@/core/catalog/downloadEpub.js";
import { createBook } from "@/core/library/createBook.js";
import { readEpubMetadata } from "@/core/epub/extractEpubPages.js";
import { supabaseBooks } from "@/adapters/supabase/supabaseBooks.js";
import { supabaseStorage } from "@/adapters/supabase/supabaseStorage.js";
import { supabaseUser } from "@/adapters/supabase/userClient.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB, matching uploads

/** Add a curated public-domain book to the caller's library. */
export async function POST(req: Request) {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const catalogId = (body ?? {}).catalogId as string | undefined;
  const entry = catalogId ? getCatalogBook(catalogId) : undefined;
  if (!entry) {
    return NextResponse.json({ error: "unknown catalog book" }, { status: 404 });
  }

  // Skip re-importing a book the user already has (by title).
  const { data: existing } = await client
    .from("books")
    .select("id,title,page_count,status,format")
    .eq("title", entry.title)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ book: existing, alreadyAdded: true });
  }

  let fileBytes: Uint8Array;
  try {
    fileBytes = await downloadEpubBytes(gutenbergEpubUrl(entry.gutenbergId), {
      fetchImpl: (url) => fetch(url, { redirect: "follow" }),
      maxBytes: MAX_FILE_SIZE,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't fetch this book from ${CATALOG_SOURCE}: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  try {
    const book = await createBook(
      { fileBytes, filename: `${entry.title}.epub`, format: "epub" },
      {
        storage: supabaseStorage(client, "pdfs", user.id),
        books: supabaseBooks(client),
        pdfMeta: { read: readEpubMetadata },
      },
    );

    // Fire-and-forget background ingestion (same pattern as upload).
    const origin = req.headers.get("origin") ?? req.headers.get("host") ?? "http://localhost:3000";
    const base = origin.startsWith("http") ? origin : `http://${origin}`;
    fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: book.id }),
    }).catch(() => {});

    return NextResponse.json({ book }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
