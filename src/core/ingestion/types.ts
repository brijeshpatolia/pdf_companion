export interface PageText {
  page: number;
  text: string;
}

export interface Chunk {
  bookId: string;
  page: number;
  text: string;
  embedding: number[];
}

export type IngestEvent =
  | { type: "status"; status: "processing" | "ready" | "failed" }
  /** Emitted once per embedded batch: how many pages are done out of the total. */
  | { type: "progress"; done: number; total: number }
  /**
   * The run hit its time budget with pages left. The book stays `processing`;
   * calling ingest again resumes from the pages already stored.
   */
  | { type: "incomplete"; done: number; total: number }
  | { type: "error"; code: "encrypted" | "no-text" | "corrupt"; message: string };

export interface PdfTextPort {
  extractPages(bytes: Uint8Array): Promise<PageText[]>;
}

export interface EmbedderPort {
  embed(texts: string[]): Promise<number[][]>;
}

export interface ChunksPort {
  /** Stores a batch, replacing anything already held for those pages. */
  upsert(bookId: string, chunks: Chunk[]): Promise<void>;
  /**
   * Pages that already have a stored chunk. This is the resume ledger — it lets
   * an interrupted ingestion pick up where it stopped instead of restarting.
   */
  embeddedPages(bookId: string): Promise<number[]>;
}

export interface IngestBooksPort {
  getFileRef(bookId: string): Promise<string>;
  updateStatus(bookId: string, status: "processing" | "ready" | "failed"): Promise<void>;
}

export interface IngestStoragePort {
  download(fileRef: string): Promise<Uint8Array>;
}

export interface IngestDeps {
  pdfText: PdfTextPort;
  embedder: EmbedderPort;
  chunks: ChunksPort;
  books: IngestBooksPort;
  storage: IngestStoragePort;
}

export interface IngestOptions {
  /** Pages embedded per batch. */
  batchSize?: number;
  /** Stop starting new batches once this much time has elapsed. */
  timeBudgetMs?: number;
  /** Clock, injectable so the budget is testable without waiting. */
  now?: () => number;
}
