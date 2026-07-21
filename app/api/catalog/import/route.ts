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

/**
 * Add a public-domain book to the caller's library — either a curated entry
 * (`catalogId`) or any Gutenberg book from live search (`gutenbergId`).
 */
export async function POST(req: Request) {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) ?? {};

  // Resolve a Gutenberg id (and, when known, a title for de-duping) from
  // either a curated catalog id or a direct gutenbergId from search.
  let gutenbergId: number;
  let knownTitle: string | undefined;
  if (typeof body.catalogId === "string") {
    const entry = getCatalogBook(body.catalogId);
    if (!entry) return NextResponse.json({ error: "unknown catalog book" }, { status: 404 });
    gutenbergId = entry.gutenbergId;
    knownTitle = entry.title;
  } else if (Number.isInteger(body.gutenbergId) && body.gutenbergId > 0) {
    gutenbergId = body.gutenbergId;
    knownTitle = typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;
  } else {
    return NextResponse.json({ error: "provide a catalogId or a valid gutenbergId" }, { status: 400 });
  }

  // Skip re-importing a book the user already has (by title, when we know it).
  if (knownTitle) {
    const { data: existing } = await client
      .from("books")
      .select("id,title,page_count,status,format")
      .eq("title", knownTitle)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ book: existing, alreadyAdded: true });
    }
  }

  let fileBytes: Uint8Array;
  try {
    fileBytes = await downloadEpubBytes(gutenbergEpubUrl(gutenbergId), {
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
      // createBook derives the real title from the EPUB; this filename is a fallback.
      { fileBytes, filename: `${knownTitle ?? `gutenberg-${gutenbergId}`}.epub`, format: "epub" },
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
