import type { IngestDeps, IngestEvent, IngestOptions } from "./types.js";

/** Pages embedded per batch. Small enough that a batch always fits a run. */
const DEFAULT_BATCH_SIZE = 25;
/**
 * Stop starting new batches after this long. Sits well inside the platform's
 * function limit so the run can finish its current batch, record progress, and
 * report `incomplete` rather than being killed mid-write.
 */
const DEFAULT_TIME_BUDGET_MS = 40_000;

/**
 * Turns a book into searchable chunks, one batch of pages at a time.
 *
 * Embedding a long book takes longer than a serverless function is allowed to
 * live, so this is **resumable**: each stored chunk records that its page is
 * done, and a later call skips those pages and continues. A run that hits its
 * time budget leaves the book `processing` and yields `incomplete` — the caller
 * simply invokes ingest again. Nothing is lost and nothing is redone.
 */
export async function* ingest(
  bookId: string,
  deps: IngestDeps,
  options: IngestOptions = {},
): AsyncGenerator<IngestEvent> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const now = options.now ?? (() => Date.now());
  const startedAt = now();

  await deps.books.updateStatus(bookId, "processing");
  yield { type: "status", status: "processing" };

  const fileRef = await deps.books.getFileRef(bookId);
  const bytes = await deps.storage.download(fileRef);

  let pages;
  try {
    pages = await deps.pdfText.extractPages(bytes);
  } catch (err: unknown) {
    const code = (err as any)?.code === "encrypted" ? ("encrypted" as const) : ("corrupt" as const);
    const message = err instanceof Error ? err.message : "Failed to extract text";
    await deps.books.updateStatus(bookId, "failed");
    yield { type: "error", code, message };
    yield { type: "status", status: "failed" };
    return;
  }

  const nonEmpty = pages.filter((p) => p.text.trim().length > 0);
  if (nonEmpty.length === 0) {
    await deps.books.updateStatus(bookId, "failed");
    yield {
      type: "error",
      code: "no-text",
      message:
        "This PDF contains no extractable text. It may be a scanned document — OCR is not yet supported.",
    };
    yield { type: "status", status: "failed" };
    return;
  }

  const total = nonEmpty.length;
  const alreadyDone = new Set(await deps.chunks.embeddedPages(bookId));
  const remaining = nonEmpty.filter((p) => !alreadyDone.has(p.page));

  let done = total - remaining.length;
  if (done > 0) yield { type: "progress", done, total };

  for (let i = 0; i < remaining.length; i += batchSize) {
    // Check the budget *before* starting a batch, so we never get killed
    // partway through one and lose the work it did. The first batch always
    // runs: text extraction alone can eat the budget on a long book, and a
    // pass that embeds nothing would leave the next one no better off.
    if (i > 0 && now() - startedAt >= timeBudgetMs) {
      yield { type: "incomplete", done, total };
      return;
    }

    const batch = remaining.slice(i, i + batchSize);
    const embeddings = await deps.embedder.embed(batch.map((p) => p.text));
    await deps.chunks.upsert(
      bookId,
      batch.map((p, j) => ({ bookId, page: p.page, text: p.text, embedding: embeddings[j]! })),
    );

    done += batch.length;
    yield { type: "progress", done, total };
  }

  await deps.books.updateStatus(bookId, "ready");
  yield { type: "status", status: "ready" };
}
