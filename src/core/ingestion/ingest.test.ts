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

function fakeChunks(): ChunksPort & { stored: Chunk[] } {
  const port = {
    stored: [] as Chunk[],
    async upsert(_bookId: string, chunks: Chunk[]) {
      port.stored = chunks;
    },
    async deleteByBook(_bookId: string) {
      port.stored = [];
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

  it("emits progress events per page", async () => {
    const pages = [
      { page: 1, text: "One." },
      { page: 2, text: "Two." },
      { page: 3, text: "Three." },
    ];
    const deps = makeDeps({ pdfText: fakePdfText(pages) });

    const events = await collect(ingest("book-1", deps));
    const progress = events.filter((e) => e.type === "progress");

    expect(progress).toEqual([
      { type: "progress", page: 1, totalPages: 3 },
      { type: "progress", page: 2, totalPages: 3 },
      { type: "progress", page: 3, totalPages: 3 },
    ]);
  });
});
