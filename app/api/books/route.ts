import { NextResponse } from "next/server";
import { createBook } from "@/core/library/createBook.js";
import { readPdfMetadata } from "@/core/library/pdfMeta.js";
import { readEpubMetadata } from "@/core/epub/extractEpubPages.js";
import { supabaseBooks } from "@/adapters/supabase/supabaseBooks.js";
import { supabaseStorage } from "@/adapters/supabase/supabaseStorage.js";
import { supabaseUser } from "@/adapters/supabase/userClient.js";
import type { BookFormat } from "@/core/library/types.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/** Cap on per-book progress counts in one library listing, which polls every 2s. */
const MAX_PROGRESS_LOOKUPS = 5;

const PDF_TYPE = "application/pdf";
const EPUB_TYPE = "application/epub+zip";

/** Detects the book format from the file's MIME type or extension. */
function detectFormat(file: File): BookFormat | null {
  const name = file.name.toLowerCase();
  if (file.type === PDF_TYPE || name.endsWith(".pdf")) return "pdf";
  if (file.type === EPUB_TYPE || name.endsWith(".epub")) return "epub";
  return null;
}

/** Upload a PDF or EPUB: store it + create a Book row via the createBook seam. */
export async function POST(req: Request) {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "expected a 'file' field" }, { status: 400 });
  }
  const format = detectFormat(file);
  if (!format) {
    return NextResponse.json({ error: "only PDF and EPUB files are supported" }, { status: 415 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.` },
      { status: 413 },
    );
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  try {
    const book = await createBook(
      { fileBytes, filename: file.name, format },
      {
        storage: supabaseStorage(client, "pdfs", user.id),
        books: supabaseBooks(client),
        pdfMeta: { read: format === "epub" ? readEpubMetadata : readPdfMetadata },
      },
    );

    // Fire-and-forget: trigger ingestion in the background
    const origin = req.headers.get("origin") ?? req.headers.get("host") ?? "http://localhost:3000";
    const base = origin.startsWith("http") ? origin : `http://${origin}`;
    fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: book.id }),
    }).catch(() => {});

    return NextResponse.json(book, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** List the signed-in user's books for the library view. */
export async function GET() {
  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS restricts this to the caller's own rows.
  const { data, error } = await client
    .from("books")
    .select("id,title,page_count,status")
    .order("title");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ingestion runs in passes, so a long book sits in `processing` for a while.
  // Count its stored chunks — that's how many pages are already searchable —
  // and only for books still in flight, so the common case costs nothing.
  const inFlight = (data ?? [])
    .filter((b) => b.status === "processing" || b.status === "uploaded")
    .slice(0, MAX_PROGRESS_LOOKUPS);
  const progress = new Map<string, number>();
  await Promise.all(
    inFlight.map(async (b) => {
      const { count } = await client
        .from("chunks")
        .select("*", { count: "exact", head: true })
        .eq("book_id", b.id);
      if (count != null) progress.set(b.id, count);
    }),
  );

  // Where the reader actually is in each book — the library's most useful
  // fact, and what separates a book being merely `ready` from one being read.
  // One query for the whole shelf rather than one per book.
  const reading = new Map<string, number>();
  if ((data ?? []).length > 0) {
    const { data: rows } = await client
      .from("reading_progress")
      .select("book_id, current_page");
    for (const r of (rows ?? []) as { book_id: string; current_page: number }[]) {
      reading.set(r.book_id, r.current_page);
    }
  }

  return NextResponse.json(
    (data ?? []).map((b) => ({
      ...b,
      pages_done: progress.get(b.id) ?? null,
      current_page: reading.get(b.id) ?? null,
    })),
  );
}

/** Delete a book, its storage file, and all cascaded data. */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) {
    return NextResponse.json({ error: "missing bookId" }, { status: 400 });
  }

  const client = await supabaseUser();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS scopes both the lookup and the delete to the owner.
  const { data: book } = await client
    .from("books")
    .select("file_ref")
    .eq("id", bookId)
    .single();

  if (!book) {
    return NextResponse.json({ error: "book not found" }, { status: 404 });
  }

  const slash = book.file_ref.indexOf("/");
  const bucket = book.file_ref.slice(0, slash);
  const path = book.file_ref.slice(slash + 1);
  await client.storage.from(bucket).remove([path]);

  const { error } = await client.from("books").delete().eq("id", bookId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
