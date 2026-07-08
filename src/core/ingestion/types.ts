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
  | { type: "progress"; page: number; totalPages: number }
  | { type: "error"; code: "encrypted" | "no-text" | "corrupt"; message: string };

export interface PdfTextPort {
  extractPages(bytes: Uint8Array): Promise<PageText[]>;
}

export interface EmbedderPort {
  embed(texts: string[]): Promise<number[][]>;
}

export interface ChunksPort {
  upsert(bookId: string, chunks: Chunk[]): Promise<void>;
  deleteByBook(bookId: string): Promise<void>;
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
