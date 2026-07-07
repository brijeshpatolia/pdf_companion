import { describe, it, expect } from "vitest";
import { createBook } from "./createBook.js";
import type { Book, BooksPort, PdfMetaPort, PdfMetadata, StoragePort } from "./types.js";

function fakeStorage() {
  const stored: { bytes: Uint8Array; filename: string; ref: string }[] = [];
  const port: StoragePort = {
    async put({ bytes, filename }) {
      const ref = `stored://${stored.length}/${filename}`;
      stored.push({ bytes, filename, ref });
      return { ref };
    },
  };
  return { port, stored };
}

function fakeBooks() {
  const rows: Book[] = [];
  const port: BooksPort = {
    async insert(book) {
      const row: Book = { id: `book-${rows.length}`, ...book };
      rows.push(row);
      return row;
    },
  };
  return { port, rows };
}

function fakePdfMeta(meta: PdfMetadata): PdfMetaPort {
  return { async read() { return meta; } };
}

describe("createBook", () => {
  it("stores the file and creates an uploaded Book with the PDF's title and page count", async () => {
    const storage = fakeStorage();
    const books = fakeBooks();
    const pdfMeta = fakePdfMeta({ title: "The Last Days of Socrates", pageCount: 288 });

    const book = await createBook(
      { fileBytes: new Uint8Array([1, 2, 3]), filename: "socrates.pdf" },
      { storage: storage.port, books: books.port, pdfMeta },
    );

    // Book carries the PDF's metadata and starts life "uploaded"
    expect(book.title).toBe("The Last Days of Socrates");
    expect(book.pageCount).toBe(288);
    expect(book.status).toBe("uploaded");
    expect(book.id).toBeTruthy();

    // the raw file was persisted and the Book points at it
    expect(storage.stored).toHaveLength(1);
    expect(book.fileRef).toBe(storage.stored[0]!.ref);

    // exactly one Book row was created
    expect(books.rows).toHaveLength(1);

    // future-owner field is present but null in the single-user MVP
    expect(book.ownerId).toBeNull();
  });

  it("falls back to the filename (without extension) when the PDF has no embedded title", async () => {
    const storage = fakeStorage();
    const books = fakeBooks();
    const pdfMeta = fakePdfMeta({ title: null, pageCount: 552 });

    const book = await createBook(
      { fileBytes: new Uint8Array([9]), filename: "designing-data-intensive-applications.pdf" },
      { storage: storage.port, books: books.port, pdfMeta },
    );

    expect(book.title).toBe("designing-data-intensive-applications");
  });
});
