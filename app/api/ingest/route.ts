import { NextRequest, NextResponse } from "next/server";
import { ingest } from "../../../src/core/ingestion/ingest.js";
import { createPdfTextExtractor } from "../../../src/core/ingestion/extractText.js";
import { createEpubTextExtractor } from "../../../src/core/epub/extractEpubPages.js";
import { supabaseServer } from "../../../src/adapters/supabase/serverClient.js";
import { supabaseChunks } from "../../../src/adapters/supabase/supabaseChunks.js";
import { supabaseIngestBooks } from "../../../src/adapters/supabase/supabaseIngestBooks.js";
import { supabaseIngestStorage } from "../../../src/adapters/supabase/supabaseIngestStorage.js";
import { createLocalEmbedder } from "../../../src/adapters/embedder/localEmbedder.js";

export async function POST(req: NextRequest) {
  let body: { bookId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { bookId } = body;
  if (!bookId) {
    return new Response("Missing bookId", { status: 400 });
  }

  const client = supabaseServer();

  // Pick the text extractor by the book's format (defaults to PDF).
  const { data: bookRow } = await client
    .from("books")
    .select("format")
    .eq("id", bookId)
    .single();
  const extractor =
    bookRow?.format === "epub" ? createEpubTextExtractor() : createPdfTextExtractor();

  const deps = {
    pdfText: extractor,
    embedder: createLocalEmbedder(),
    chunks: supabaseChunks(client),
    books: supabaseIngestBooks(client),
    storage: supabaseIngestStorage(client),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of ingest(bookId, deps)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", code: "corrupt", message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
