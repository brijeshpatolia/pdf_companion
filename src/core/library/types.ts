/**
 * Library domain types for the Reading loop core (issue #2).
 *
 * `Book` is the V1-shaped entity from the PRD: it carries future-owner fields
 * (`ownerId`) even though the MVP is single-user, so adding auth later is additive.
 * Ports are injected (accept, don't create) so the domain module is testable
 * through fakes — the fake-adapter pattern issue #2 exists to establish.
 */

export type IngestionStatus = "uploaded" | "processing" | "ready" | "failed";

export type BookFormat = "pdf" | "epub";

export interface Book {
  id: string;
  ownerId: string | null;
  title: string;
  pageCount: number;
  fileRef: string;
  status: IngestionStatus;
  format: BookFormat;
}

export interface PdfMetadata {
  title: string | null;
  pageCount: number;
}

/** Persists the raw PDF bytes and returns an opaque reference to them. */
export interface StoragePort {
  put(input: { bytes: Uint8Array; filename: string }): Promise<{ ref: string }>;
}

/** Persists a Book row, assigning its id. */
export interface BooksPort {
  insert(book: Omit<Book, "id">): Promise<Book>;
}

/** Reads title + page count from PDF bytes (metadata only, not full text). */
export interface PdfMetaPort {
  read(bytes: Uint8Array): Promise<PdfMetadata>;
}

export interface CreateBookDeps {
  storage: StoragePort;
  books: BooksPort;
  pdfMeta: PdfMetaPort;
}

export interface CreateBookInput {
  fileBytes: Uint8Array;
  filename: string;
  /** Defaults to "pdf" when omitted. */
  format?: BookFormat;
}
