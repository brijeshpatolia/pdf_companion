import { describe, it, expect } from "vitest";
import { mapGutendexBooks, gutendexSearchUrl } from "./gutendex.js";

// Trimmed but structurally real Gutendex payload.
const SAMPLE = {
  count: 3,
  next: "https://gutendex.com/books/?page=2&search=x",
  previous: null,
  results: [
    {
      id: 2680,
      title: "Meditations",
      authors: [{ name: "Marcus Aurelius, Emperor of Rome", birth_year: 121 }],
      languages: ["en"],
      download_count: 60197,
      formats: {
        "text/html": "https://www.gutenberg.org/ebooks/2680.html.images",
        "application/epub+zip": "https://www.gutenberg.org/ebooks/2680.epub3.images",
        "image/jpeg": "https://www.gutenberg.org/cache/epub/2680/pg2680.cover.medium.jpg",
      },
    },
    {
      // No EPUB format — must be dropped.
      id: 99999,
      title: "Audio Only",
      authors: [{ name: "Someone" }],
      languages: ["en"],
      download_count: 5,
      formats: { "text/plain": "https://x/plain.txt" },
    },
    {
      id: 1232,
      title: "The Prince",
      authors: [{ name: "Machiavelli, Niccolò" }],
      languages: ["en", "it"],
      download_count: 100,
      formats: { "application/epub+zip; charset=utf-8": "https://x/prince.epub" },
    },
  ],
};

describe("mapGutendexBooks", () => {
  it("keeps only books with an EPUB format", () => {
    const { results } = mapGutendexBooks(SAMPLE);
    expect(results.map((r) => r.gutenbergId)).toEqual([2680, 1232]);
  });

  it("keeps the author name verbatim (no risky comma-flipping)", () => {
    const { results } = mapGutendexBooks(SAMPLE);
    expect(results[0]!.author).toBe("Marcus Aurelius, Emperor of Rome");
    expect(results[1]!.author).toBe("Machiavelli, Niccolò");
  });

  it("extracts cover url and download count, and reports pagination", () => {
    const page = mapGutendexBooks(SAMPLE);
    expect(page.results[0]!.coverUrl).toContain("cover.medium.jpg");
    expect(page.results[0]!.downloadCount).toBe(60197);
    expect(page.hasMore).toBe(true);
  });

  it("matches EPUB formats with a charset suffix", () => {
    const { results } = mapGutendexBooks(SAMPLE);
    expect(results[1]!.gutenbergId).toBe(1232);
  });

  it("handles empty / malformed input safely", () => {
    expect(mapGutendexBooks(null)).toEqual({ results: [], hasMore: false });
    expect(mapGutendexBooks({ results: "nope" })).toEqual({ results: [], hasMore: false });
  });
});

describe("gutendexSearchUrl", () => {
  it("uses the trailing slash and encodes the query", () => {
    expect(gutendexSearchUrl("marcus aurelius")).toBe(
      "https://gutendex.com/books/?search=marcus+aurelius",
    );
  });

  it("adds a page param only beyond page 1", () => {
    expect(gutendexSearchUrl("x", 1)).not.toContain("page=");
    expect(gutendexSearchUrl("x", 2)).toContain("page=2");
  });
});
