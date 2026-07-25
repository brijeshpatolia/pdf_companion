import { describe, it, expect } from "vitest";
import { ingest } from "./ingest.js";
import type {
  IngestDeps,
  IngestEvent,
  PdfTextPort,
  EmbedderPort,
  ChunksPort,
  IngestBooksPort,
  IngestStoragePort,
  Chunk,
} from "./types.js";

// ── Fakes ──────────────────────────────────────────────────────────

function fakePdfText(pages = [{ page: 1, text: "Hello world." }]): PdfTextPort {
  return {
    async extractPages() {
      return pages;
    },
  };
}

function fakeEmbedder(dim = 3): EmbedderPort {
  return {
    async embed(texts) {
      return texts.map((_, i) => Array.from({ length: dim }, (__, j) => i + j * 0.1));
    },
  };
}

/**
 * Stands in for the chunks table, including its role as the resume ledger:
 * writes accumulate across calls and replace whatever was held for those pages.
 */
function fakeChunks(seed: Chunk[] = []): ChunksPort & { stored: Chunk[]; batches: number } {
  const port = {
    stored: [...seed],
    batches: 0,
    async upsert(_bookId: string, chunks: Chunk[]) {
      port.batches += 1;
      const pages = new Set(chunks.map((c) => c.page));
      port.stored = [...port.stored.filter((c) => !pages.has(c.page)), ...chunks];
    },
    async embeddedPages(_bookId: string) {
      return [...new Set(port.stored.map((c) => c.page))];
    },
  };
  return port;
}

function fakeBooks(): IngestBooksPort & { statuses: string[] } {
  const port = {
    statuses: [] as string[],
    async getFileRef() {
      return "pdfs/abc/test.pdf";
    },
    async updateStatus(_bookId: string, status: string) {
      port.statuses.push(status);
    },
  };
  return port;
}

function fakeStorage(bytes = new Uint8Array([1, 2, 3])): IngestStoragePort {
  return {
    async download() {
      return bytes;
    },
  };
}

function makeDeps(overrides?: Partial<IngestDeps>): IngestDeps {
  return {
    pdfText: fakePdfText(),
    embedder: fakeEmbedder(),
    chunks: fakeChunks(),
    books: fakeBooks(),
    storage: fakeStorage(),
    ...overrides,
  };
}

/** `n` pages of throwaway text, numbered from 1. */
function manyPages(n: number) {
  return Array.from({ length: n }, (_, i) => ({ page: i + 1, text: `Page ${i + 1}.` }));
}

async function collect(iter: AsyncIterable<IngestEvent>): Promise<IngestEvent[]> {
  const events: IngestEvent[] = [];
  for await (const e of iter) events.push(e);
  return events;
}

// ── Tests ──────────────────────────────────────────────────────────

describe("ingest", () => {
  it("drives status through processing → ready", async () => {
    const books = fakeBooks();
    const deps = makeDeps({ books });

    const events = await collect(ingest("book-1", deps));

    expect(books.statuses).toEqual(["processing", "ready"]);
    const statusEvents = events.filter((e) => e.type === "status");
    expect(statusEvents).toEqual([
      { type: "status", status: "processing" },
      { type: "status", status: "ready" },
    ]);
  });

  it("stores chunks with correct page numbers and non-empty embeddings", async () => {
    const pages = [
      { page: 1, text: "Page one." },
      { page: 2, text: "Page two." },
    ];
    const chunksPort = fakeChunks();
    const deps = makeDeps({ pdfText: fakePdfText(pages), chunks: chunksPort });

    await collect(ingest("book-1", deps));

    expect(chunksPort.stored).toHaveLength(2);
    expect(chunksPort.stored[0]!.page).toBe(1);
    expect(chunksPort.stored[0]!.text).toBe("Page one.");
    expect(chunksPort.stored[0]!.embedding.length).toBeGreaterThan(0);
    expect(chunksPort.stored[1]!.page).toBe(2);
    expect(chunksPort.stored[1]!.text).toBe("Page two.");
    expect(chunksPort.stored[1]!.embedding.length).toBeGreaterThan(0);
  });

  it("rejects encrypted PDFs with error and sets status to failed", async () => {
    const encryptedPdf: PdfTextPort = {
      async extractPages() {
        const err = new Error("PDF is password-protected");
        (err as any).code = "encrypted";
        throw err;
      },
    };
    const books = fakeBooks();
    const deps = makeDeps({ pdfText: encryptedPdf, books });

    const events = await collect(ingest("book-1", deps));

    expect(books.statuses).toEqual(["processing", "failed"]);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toMatchObject({ type: "error", code: "encrypted" });
  });

  it("rejects image-only PDFs with no-text error", async () => {
    const imageOnly: PdfTextPort = {
      async extractPages() {
        return [{ page: 1, text: "" }, { page: 2, text: "   " }];
      },
    };
    const books = fakeBooks();
    const deps = makeDeps({ pdfText: imageOnly, books });

    const events = await collect(ingest("book-1", deps));

    expect(books.statuses).toEqual(["processing", "failed"]);
    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toMatchObject({ type: "error", code: "no-text" });
  });

  it("is idempotent — re-ingesting does not duplicate chunks", async () => {
    const chunksPort = fakeChunks();
    const pages = [{ page: 1, text: "Content." }];
    const deps = makeDeps({ chunks: chunksPort, pdfText: fakePdfText(pages) });

    await collect(ingest("book-1", deps));
    expect(chunksPort.stored).toHaveLength(1);

    await collect(ingest("book-1", deps));
    expect(chunksPort.stored).toHaveLength(1);
  });

  it("skips pages that are already embedded", async () => {
    const pages = manyPages(3);
    // Page 2 survived an earlier run; only 1 and 3 should be embedded now.
    const chunksPort = fakeChunks([
      { bookId: "book-1", page: 2, text: "Page 2.", embedding: [0, 0, 0] },
    ]);
    const embedded: string[][] = [];
    const embedder: EmbedderPort = {
      async embed(texts) {
        embedded.push(texts);
        return texts.map(() => [1, 2, 3]);
      },
    };
    const deps = makeDeps({ pdfText: fakePdfText(pages), chunks: chunksPort, embedder });

    await collect(ingest("book-1", deps));

    expect(embedded).toEqual([["Page 1.", "Page 3."]]);
    expect(chunksPort.stored).toHaveLength(3);
  });

  it("counts pre-existing pages toward progress", async () => {
    const chunksPort = fakeChunks([
      { bookId: "book-1", page: 1, text: "Page 1.", embedding: [0, 0, 0] },
    ]);
    const deps = makeDeps({ pdfText: fakePdfText(manyPages(2)), chunks: chunksPort });

    const events = await collect(ingest("book-1", deps));

    expect(events.filter((e) => e.type === "progress")).toEqual([
      { type: "progress", done: 1, total: 2 },
      { type: "progress", done: 2, total: 2 },
    ]);
  });

  it("emits one progress event per batch, counting pages done", async () => {
    const deps = makeDeps({ pdfText: fakePdfText(manyPages(5)) });

    const events = await collect(ingest("book-1", deps, { batchSize: 2 }));

    expect(events.filter((e) => e.type === "progress")).toEqual([
      { type: "progress", done: 2, total: 5 },
      { type: "progress", done: 4, total: 5 },
      { type: "progress", done: 5, total: 5 },
    ]);
  });

  it("embeds a whole batch in a single call", async () => {
    const embedded: string[][] = [];
    const embedder: EmbedderPort = {
      async embed(texts) {
        embedded.push(texts);
        return texts.map(() => [1, 2, 3]);
      },
    };
    const deps = makeDeps({ pdfText: fakePdfText(manyPages(3)), embedder });

    await collect(ingest("book-1", deps, { batchSize: 2 }));

    expect(embedded).toEqual([["Page 1.", "Page 2."], ["Page 3."]]);
  });

  it("stops at the time budget, reports incomplete, and leaves the book processing", async () => {
    const books = fakeBooks();
    const chunksPort = fakeChunks();
    // The clock advances 10ms per reading. The first batch is unconditional,
    // the check before the second passes at 10ms, and the one before the third
    // fails at 20ms — so two batches run and the third never starts.
    let clock = 0;
    const deps = makeDeps({ pdfText: fakePdfText(manyPages(6)), books, chunks: chunksPort });

    const events = await collect(
      ingest("book-1", deps, {
        batchSize: 2,
        timeBudgetMs: 15,
        now: () => (clock += 10) - 10,
      }),
    );

    expect(events.at(-1)).toEqual({ type: "incomplete", done: 4, total: 6 });
    expect(events.some((e) => e.type === "status" && e.status === "ready")).toBe(false);
    expect(books.statuses).toEqual(["processing"]);
    expect(chunksPort.stored).toHaveLength(4);
  });

  it("always embeds one batch, even when extraction alone blew the budget", async () => {
    // Otherwise a long book whose text extraction outlasts the budget would
    // hand off forever without a single page ever being embedded.
    const chunksPort = fakeChunks();
    const deps = makeDeps({ pdfText: fakePdfText(manyPages(4)), chunks: chunksPort });

    // The budget starts before extraction, so the very first reading inside the
    // loop is already far past it.
    let reading = 0;
    const events = await collect(
      ingest("book-1", deps, {
        batchSize: 2,
        timeBudgetMs: 1,
        now: () => (reading++ === 0 ? 0 : 10_000),
      }),
    );

    expect(chunksPort.batches).toBe(1);
    expect(events.at(-1)).toEqual({ type: "incomplete", done: 2, total: 4 });
  });

  it("finishes a book across successive runs, embedding each page once", async () => {
    const chunksPort = fakeChunks();
    const books = fakeBooks();
    const embedded: string[] = [];
    const embedder: EmbedderPort = {
      async embed(texts) {
        embedded.push(...texts);
        return texts.map(() => [1, 2, 3]);
      },
    };
    const deps = makeDeps({
      pdfText: fakePdfText(manyPages(6)),
      chunks: chunksPort,
      books,
      embedder,
    });
    // A run that allows exactly two batches before its budget runs out.
    const run = () => {
      let clock = 0;
      return ingest("book-1", deps, {
        batchSize: 2,
        timeBudgetMs: 15,
        now: () => (clock += 10) - 10,
      });
    };

    const first = await collect(run());
    expect(first.at(-1)).toEqual({ type: "incomplete", done: 4, total: 6 });

    const second = await collect(run());
    expect(second.at(-1)).toEqual({ type: "status", status: "ready" });

    expect(chunksPort.stored).toHaveLength(6);
    expect(embedded).toEqual(manyPages(6).map((p) => p.text));
    expect(books.statuses).toEqual(["processing", "processing", "ready"]);
  });
});
