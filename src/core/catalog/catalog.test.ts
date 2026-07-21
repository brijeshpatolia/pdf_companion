import { describe, it, expect } from "vitest";
import { CATALOG, getCatalogBook, gutenbergEpubUrl } from "./catalog.js";

describe("CATALOG", () => {
  it("has unique, well-formed entries", () => {
    const ids = new Set<string>();
    for (const book of CATALOG) {
      expect(book.id).toMatch(/^gutenberg-\d+$/);
      expect(ids.has(book.id)).toBe(false);
      ids.add(book.id);
      expect(book.title.trim()).not.toBe("");
      expect(book.author.trim()).not.toBe("");
      expect(book.description.trim()).not.toBe("");
      expect(book.gutenbergId).toBeGreaterThan(0);
      // The id encodes the Gutenberg id.
      expect(book.id).toBe(`gutenberg-${book.gutenbergId}`);
    }
  });

  it("looks up a book by id", () => {
    expect(getCatalogBook("gutenberg-1497")?.title).toBe("The Republic");
    expect(getCatalogBook("nope")).toBeUndefined();
  });

  it("builds a Gutenberg EPUB url", () => {
    expect(gutenbergEpubUrl(1497)).toBe("https://www.gutenberg.org/ebooks/1497.epub3.images");
  });
});
