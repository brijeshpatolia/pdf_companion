import { NextResponse } from "next/server";
import { createBook } from "@/core/library/createBook.js";
import { readPdfMetadata } from "@/core/library/pdfMeta.js";
import { supabaseBooks } from "@/adapters/supabase/supabaseBooks.js";
import { supabaseStorage } from "@/adapters/supabase/supabaseStorage.js";
import { supabaseServer } from "@/adapters/supabase/serverClient.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/** Upload a PDF: store it + create a Book row via the createBook seam. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "expected a 'file' field" }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "only PDF files are supported" }, { status: 415 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.` },
      { status: 413 },
    );
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const client = supabaseServer();
  try {
    const book = await createBook(
      { fileBytes, filename: file.name },
      {
        storage: supabaseStorage(client),
        books: supabaseBooks(client),
        pdfMeta: { read: readPdfMetadata },
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

/** List uploaded books for the library view. */
export async function GET() {
  const client = supabaseServer();
  const { data, error } = await client
    .from("books")
    .select("id,title,page_count,status")
    .order("title");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
