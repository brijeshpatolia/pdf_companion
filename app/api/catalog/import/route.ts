import { NextResponse } from "next/server";
import { getCatalogBook, gutenbergEpubUrl } from "@/core/catalog/catalog.js";
import { downloadEpubBytes } from "@/core/catalog/downloadEpub.js";
import {
  archiveDownloadUrl,
  archiveMetadataUrl,
  isImportableArchiveItem,
  isValidArchiveId,
  pickArchiveEpub,
} from "@/core/catalog/archive.js";
import { createBook } from "@/core/library/createBook.js";
import { readEpubMetadata } from "@/core/epub/extractEpubPages.js";
import { supabaseBooks } from "@/adapters/supabase/supabaseBooks.js";
import { supabaseStorage } from "@/adapters/supabase/supabaseStorage.js";
import { supabaseUser } from "@/adapters/supabase/userClient.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB, matching uploads

interface Resolved {
  downloadUrl: string;
  knownTitle?: string;
  sourceLabel: string;
}

/** JSON error thrown from resolution so we can attach a status code. */
class ImportError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Turn the request body into a concrete EPUB download URL. For Internet
 * Archive this fetches the item's authoritative metadata and re-verifies it
 * is public-domain and non-restricted before yielding a URL — the client's
 * request is never trusted on that point.
 */
async function resolveSource(body: Record<string, unknown>): Promise<Resolved> {
  if (typeof body.catalogId === "string") {
    const entry = getCatalogBook(body.catalogId);
    if (!entry) throw new ImportError("unknown catalog book", 404);
    return { downloadUrl: gutenbergEpubUrl(entry.gutenbergId), knownTitle: entry.title, sourceLabel: "Project Gutenberg" };
  }

  if (Number.isInteger(body.gutenbergId) && (body.gutenbergId as number) > 0) {
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;
    return { downloadUrl: gutenbergEpubUrl(body.gutenbergId as number), knownTitle: title, sourceLabel: "Project Gutenberg" };
  }

  if (isValidArchiveId(body.archiveId)) {
    const id = body.archiveId;
    const res = await fetch(archiveMetadataUrl(id), { redirect: "follow" });
    if (!res.ok) throw new ImportError(`Couldn't reach the Internet Archive (${res.status})`, 502);
    const meta = await res.json();
    if (!isImportableArchiveItem(meta)) {
      throw new ImportError("This Internet Archive item isn't available as a free public-domain download.", 403);
    }
    const epub = pickArchiveEpub(meta);
    if (!epub) throw new ImportError("This item has no EPUB to import.", 422);
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : typeof meta.metadata?.title === "string"
          ? meta.metadata.title
          : undefined;
    return { downloadUrl: archiveDownloadUrl(id, epub), knownTitle: title, sourceLabel: "the Internet Archive" };
  }

  throw new ImportError("provide a catalogId, gutenbergId, or archiveId", 400);
}

/** Add a public-domain book (curated, Gutenberg, or Internet Archive) to the library. */
export async function POST(req: Request) {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) ?? {};

  let resolved: Resolved;
  try {
    resolved = await resolveSource(body);
  } catch (e) {
    if (e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Skip re-importing a book the user already has (by title, when we know it).
  if (resolved.knownTitle) {
    const { data: existing } = await client
      .from("books")
      .select("id,title,page_count,status,format")
      .eq("title", resolved.knownTitle)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ book: existing, alreadyAdded: true });
    }
  }

  let fileBytes: Uint8Array;
  try {
    fileBytes = await downloadEpubBytes(resolved.downloadUrl, {
      fetchImpl: (url) => fetch(url, { redirect: "follow" }),
      maxBytes: MAX_FILE_SIZE,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't fetch this book from ${resolved.sourceLabel}: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  try {
    const book = await createBook(
      // createBook derives the real title from the EPUB; this filename is a fallback
      // (Internet Archive EPUBs often lack an embedded title, so the search title wins).
      { fileBytes, filename: `${resolved.knownTitle ?? "book"}.epub`, format: "epub" },
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
