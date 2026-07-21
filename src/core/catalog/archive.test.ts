import { describe, it, expect } from "vitest";
import {
  archiveSearchUrl,
  sanitizeArchiveQuery,
  mapArchiveSearch,
  isImportableArchiveItem,
  pickArchiveEpub,
  isValidArchiveId,
  archiveDownloadUrl,
} from "./archive.js";

describe("sanitizeArchiveQuery", () => {
  it("strips Lucene operators that could bypass the safety filter", () => {
    const dirty = 'plato) OR access-restricted-item:true AND format:(pdf';
    const clean = sanitizeArchiveQuery(dirty);
    expect(clean).not.toMatch(/[:"()[\]{}]/);
    expect(clean).not.toContain("access-restricted-item:");
  });

  it("keeps plain words and spaces", () => {
    expect(sanitizeArchiveQuery("  marcus   aurelius ")).toBe("marcus aurelius");
  });
});

describe("archiveSearchUrl", () => {
  it("always ANDs the public-domain safety filter and never trusts raw input", () => {
    const url = archiveSearchUrl('foo) OR access-restricted-item:true');
    const q = new URL(url).searchParams.get("q")!;
    expect(q).toContain("possible-copyright-status:NOT_IN_COPYRIGHT");
    expect(q).toContain("-access-restricted-item:true");
    expect(q).toContain("-collection:opensource");
    expect(q).toContain("format:EPUB");
    // The injected clause is neutralized (no bare "access-restricted-item:true").
    expect(q).not.toMatch(/\(.*access-restricted-item:true.*\) AND/);
  });

  it("paginates via the page param", () => {
    expect(new URL(archiveSearchUrl("x", 3)).searchParams.get("page")).toBe("3");
  });
});

describe("mapArchiveSearch", () => {
  const sample = {
    response: {
      numFound: 100,
      start: 0,
      docs: [
        { identifier: "problemsofphilo00russuoft", title: "The Problems of Philosophy", creator: "Russell, Bertrand", year: 1912 },
        { identifier: "bad id with spaces", title: "Skip me", creator: "x" },
        { identifier: "analects00conf", title: ["The Analects"], creator: ["Confucius", "Soothill"] },
      ],
    },
  };

  it("maps docs, drops invalid identifiers, and builds a cover url", () => {
    const { results, hasMore } = mapArchiveSearch(sample);
    expect(results.map((r) => r.archiveId)).toEqual(["problemsofphilo00russuoft", "analects00conf"]);
    expect(results[0]!.coverUrl).toBe("https://archive.org/services/img/problemsofphilo00russuoft");
    expect(results[0]!.year).toBe(1912);
    expect(hasMore).toBe(true);
  });

  it("joins array title/creator fields", () => {
    const { results } = mapArchiveSearch(sample);
    expect(results[1]!.title).toBe("The Analects");
    expect(results[1]!.author).toBe("Confucius, Soothill");
  });

  it("handles malformed input", () => {
    expect(mapArchiveSearch(null)).toEqual({ results: [], hasMore: false });
  });
});

describe("isImportableArchiveItem", () => {
  it("allows only NOT_IN_COPYRIGHT, non-restricted, non-dark items", () => {
    expect(isImportableArchiveItem({ metadata: { "possible-copyright-status": "NOT_IN_COPYRIGHT" } })).toBe(true);
    expect(isImportableArchiveItem({ metadata: { "possible-copyright-status": "IN_COPYRIGHT" } })).toBe(false);
    expect(
      isImportableArchiveItem({ metadata: { "possible-copyright-status": "NOT_IN_COPYRIGHT", "access-restricted-item": "true" } }),
    ).toBe(false);
    expect(isImportableArchiveItem({ is_dark: true, metadata: { "possible-copyright-status": "NOT_IN_COPYRIGHT" } })).toBe(false);
  });
});

describe("pickArchiveEpub", () => {
  it("finds an EPUB file by format or extension", () => {
    expect(
      pickArchiveEpub({ files: [{ name: "scan_djvu.txt", format: "DjVuTXT" }, { name: "book.epub", format: "EPUB" }] }),
    ).toBe("book.epub");
    expect(pickArchiveEpub({ files: [{ name: "only.pdf", format: "Text PDF" }] })).toBeUndefined();
  });
});

describe("isValidArchiveId / archiveDownloadUrl", () => {
  it("validates identifiers", () => {
    expect(isValidArchiveId("problems_of-philo.00")).toBe(true);
    expect(isValidArchiveId("has spaces")).toBe(false);
    expect(isValidArchiveId("../etc/passwd")).toBe(false);
    expect(isValidArchiveId(123)).toBe(false);
  });

  it("builds a download url", () => {
    expect(archiveDownloadUrl("abc", "abc.epub")).toBe("https://archive.org/download/abc/abc.epub");
  });
});
