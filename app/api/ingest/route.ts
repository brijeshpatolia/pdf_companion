import { NextRequest, NextResponse } from "next/server";
import { ingest } from "../../../src/core/ingestion/ingest.js";
import { createPdfTextExtractor } from "../../../src/core/ingestion/extractText.js";
import { supabaseServer } from "../../../src/adapters/supabase/serverClient.js";
import { supabaseChunks } from "../../../src/adapters/supabase/supabaseChunks.js";
import { supabaseIngestBooks } from "../../../src/adapters/supabase/supabaseIngestBooks.js";
import { supabaseIngestStorage } from "../../../src/adapters/supabase/supabaseIngestStorage.js";
import type { EmbedderPort } from "../../../src/core/ingestion/types.js";

// Placeholder local embedder — produces deterministic 384-dim vectors from text hash.
// Will be replaced with a real local embedding model in a later slice.
function placeholderEmbedder(): EmbedderPort {
  return {
    async embed(texts) {
      return texts.map((t) => {
        let hash = 0;
        for (let i = 0; i < t.length; i++) {
          hash = ((hash << 5) - hash + t.charCodeAt(i)) | 0;
        }
        return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.5);
      });
    },
  };
}

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

  const deps = {
    pdfText: createPdfTextExtractor(),
    embedder: placeholderEmbedder(),
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
