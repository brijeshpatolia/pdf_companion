import { describe, it, expect } from "vitest";
import { searchCatalog, type SearchDeps } from "./search.js";

/** A Gutendex payload with one EPUB-bearing book. */
const gutendexJson = {
  next: null,
  results: [
    {
      id: 1342,
      title: "Pride and Prejudice",
      authors: [{ name: "Austen, Jane" }],
      languages: ["en"],
      download_count: 100,
      formats: {
        "application/epub+zip": "https://example.test/1342.epub",
        "image/jpeg": "https://example.test/1342.jpg",
      },
    },
  ],
};

/** An Internet Archive payload with one item. */
const archiveJson = {
  response: {
    numFound: 1,
    start: 0,
    docs: [{ identifier: "prideprejudice00aust", title: "Pride and Prejudice", creator: "Jane Austen", year: 1918 }],
  },
};

/** Answers per host, and records every URL asked for. */
function deps(handlers: { gutendex?: () => unknown; archive?: () => unknown }): SearchDeps & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    async fetchJson(url: string) {
      urls.push(url);
      const handler = url.includes("gutendex.com") ? handlers.gutendex : handlers.archive;
      if (!handler) throw new Error("upstream responded 502");
      return handler();
    },
  };
}

describe("searchCatalog", () => {
  it("returns Gutenberg results when Gutenberg answers", async () => {
    const d = deps({ gutendex: () => gutendexJson });
    const out = await searchCatalog("gutenberg", "austen", 1, d);

    expect(out.source).toBe("gutenberg");
    expect(out.fellBack).toBe(false);
    expect(out.note).toBeUndefined();
    expect(out.results).toHaveLength(1);
    expect(d.urls.every((u) => u.includes("gutendex.com"))).toBe(true);
  });

  it("falls back to the Internet Archive when Gutenberg is blocked", async () => {
    // The production failure: Gutendex 403s requests from datacenter IPs.
    const d = deps({
      gutendex: () => {
        throw new Error("upstream responded 403");
      },
      archive: () => archiveJson,
    });

    const out = await searchCatalog("gutenberg", "austen", 1, d);

    expect(out.source).toBe("archive");
    expect(out.fellBack).toBe(true);
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({ archiveId: "prideprejudice00aust" });
  });

  it("says which source answered and why, so the reader isn't misled", async () => {
    const d = deps({
      gutendex: () => {
        throw new Error("upstream responded 403");
      },
      archive: () => archiveJson,
    });

    const { note } = await searchCatalog("gutenberg", "austen", 1, d);

    expect(note).toContain("403");
    expect(note).toContain("Internet Archive");
  });

  it("carries the page through to the fallback source", async () => {
    const d = deps({
      gutendex: () => {
        throw new Error("upstream responded 403");
      },
      archive: () => archiveJson,
    });

    await searchCatalog("gutenberg", "austen", 3, d);

    const archiveUrl = d.urls.find((u) => u.includes("archive.org"))!;
    expect(archiveUrl).toBeDefined();
    expect(archiveUrl).toContain("page=3");
  });

  it("does not fall back when the Archive was the source asked for", async () => {
    // Gutenberg is the unreliable one from a datacenter; retrying against it
    // would just add latency before the same failure.
    const d = deps({
      archive: () => {
        throw new Error("upstream responded 503");
      },
      gutendex: () => gutendexJson,
    });

    await expect(searchCatalog("archive", "austen", 1, d)).rejects.toThrow(/503/);
    expect(d.urls.every((u) => u.includes("archive.org"))).toBe(true);
  });

  it("surfaces the failure when both sources are down", async () => {
    const d = deps({
      gutendex: () => {
        throw new Error("upstream responded 403");
      },
      archive: () => {
        throw new Error("upstream responded 503");
      },
    });

    await expect(searchCatalog("gutenberg", "austen", 1, d)).rejects.toThrow(/503/);
  });

  it("keeps the Archive's public-domain filter on the fallback query", async () => {
    // The fallback must not become a way around the copyright guard.
    const d = deps({
      gutendex: () => {
        throw new Error("upstream responded 403");
      },
      archive: () => archiveJson,
    });

    await searchCatalog("gutenberg", "austen", 1, d);

    const archiveUrl = decodeURIComponent(d.urls.find((u) => u.includes("archive.org"))!);
    expect(archiveUrl).toContain("access-restricted-item");
    expect(archiveUrl).toContain("-collection:opensource");
  });
});
