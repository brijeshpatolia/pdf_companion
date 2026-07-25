import { NextRequest, NextResponse } from "next/server";
import { ingest } from "../../../src/core/ingestion/ingest.js";
import { createPdfTextExtractor } from "../../../src/core/ingestion/extractText.js";
import { createEpubTextExtractor } from "../../../src/core/epub/extractEpubPages.js";
import { supabaseServer } from "../../../src/adapters/supabase/serverClient.js";
import { supabaseChunks } from "../../../src/adapters/supabase/supabaseChunks.js";
import { supabaseIngestBooks } from "../../../src/adapters/supabase/supabaseIngestBooks.js";
import { supabaseIngestStorage } from "../../../src/adapters/supabase/supabaseIngestStorage.js";
import { createLocalEmbedder } from "../../../src/adapters/embedder/localEmbedder.js";

// Ingestion runs PDF/EPUB text extraction plus the in-process embedding model,
// so it needs the Node runtime and the longest duration the plan allows.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Safety net for self-continuation: a book needing more passes than this has
 * something wrong with it, and we'd rather stop than loop forever.
 */
const MAX_PASSES = 40;

/**
 * Both knobs default to values that fit `maxDuration` above; they're
 * overridable because the right budget depends on where this is deployed.
 */
const positiveEnv = (name: string) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const ingestOptions = {
  batchSize: positiveEnv("INGEST_BATCH_SIZE"),
  timeBudgetMs: positiveEnv("INGEST_TIME_BUDGET_MS"),
};

export async function POST(req: NextRequest) {
  let body: { bookId?: string; pass?: number };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { bookId } = body;
  const pass = Number(body.pass) || 1;
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

  // Where to reach ourselves for the next pass. Same origin/host derivation the
  // upload and catalog-import routes use to kick off the first pass.
  const origin = req.headers.get("origin") ?? req.headers.get("host") ?? "http://localhost:3000";
  const base = origin.startsWith("http") ? origin : `http://${origin}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // The client watching this stream may walk away mid-ingestion; that must
      // not stop the work or the hand-off to the next pass.
      let open = true;
      const send = (event: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      let unfinished = false;
      try {
        for await (const event of ingest(bookId, deps, ingestOptions)) {
          if (event.type === "incomplete") unfinished = true;
          send(event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", code: "corrupt", message });
      } finally {
        if (unfinished && pass < MAX_PASSES) {
          // Hand off to a fresh function invocation with its own time budget.
          // The book stays `processing` and the next pass resumes from the
          // pages already embedded, so nothing is redone.
          await fetch(`${base}/api/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookId, pass: pass + 1 }),
          }).catch(() => {});
        } else if (unfinished) {
          await deps.books.updateStatus(bookId, "failed").catch(() => {});
          send({
            type: "error",
            code: "corrupt",
            message: "This book is taking too many passes to process. Try again or re-upload it.",
          });
        }
        if (open) controller.close();
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
