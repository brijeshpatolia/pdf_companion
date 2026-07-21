import { describe, it, expect } from "vitest";
import { paginateChapters } from "./paginate.js";

describe("paginateChapters", () => {
  it("keeps a short chapter as a single page", () => {
    const pages = paginateChapters(["Short chapter."], 1800);
    expect(pages).toEqual(["Short chapter."]);
  });

  it("never lets a page span two chapters", () => {
    const pages = paginateChapters(["Chapter one text.", "Chapter two text."], 1800);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toBe("Chapter one text.");
    expect(pages[1]).toBe("Chapter two text.");
  });

  it("splits a long chapter into multiple bounded pages at paragraph breaks", () => {
    const para = "This is a paragraph of some length.";
    const chapter = Array.from({ length: 20 }, () => para).join("\n\n");
    const pages = paginateChapters([chapter], 200);

    expect(pages.length).toBeGreaterThan(1);
    // Each page respects the target with a little slack, and never splits a word.
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(260);
      expect(page.trim()).toBe(page);
    }
    // No text is lost.
    const rejoinedWords = pages.join(" ").split(/\s+/).length;
    const originalWords = chapter.split(/\s+/).length;
    expect(rejoinedWords).toBe(originalWords);
  });

  it("splits a single oversized paragraph on word boundaries without breaking words", () => {
    const originalWords = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const pages = paginateChapters([originalWords.join(" ")], 120);

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(120);
    }
    // Every original word survives intact and in order — none was split.
    expect(pages.join(" ").split(/\s+/)).toEqual(originalWords);
  });

  it("drops empty chapters", () => {
    const pages = paginateChapters(["", "  ", "Real content."]);
    expect(pages).toEqual(["Real content."]);
  });
});
