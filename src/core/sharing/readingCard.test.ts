import { describe, it, expect } from "vitest";
import { buildReadingCard, quoteFontSize, truncateQuote } from "./readingCard.js";

const stats = {
  title: "Meditations",
  author: "Marcus Aurelius",
  currentPage: 50,
  pageCount: 200,
  highlightCount: 12,
  noteCount: 3,
};

describe("quoteFontSize", () => {
  it("gives a short quote room to be the hero", () => {
    expect(quoteFontSize(40)).toBe(64);
  });

  it("shrinks monotonically as the quote grows", () => {
    const sizes = [40, 100, 160, 250].map(quoteFontSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });
});

describe("truncateQuote", () => {
  it("leaves a short quote alone", () => {
    expect(truncateQuote("the unexamined life")).toBe("the unexamined life");
  });

  it("collapses the whitespace a PDF text layer leaves behind", () => {
    expect(truncateQuote("the   unexamined\n\nlife")).toBe("the unexamined life");
  });

  it("cuts on a word boundary, not mid-word", () => {
    const original = "alpha bravo charlie delta echo foxtrot";
    const out = truncateQuote(original, 20);
    expect(out.endsWith("…")).toBe(true);
    // Every word kept must be a whole word from the original — "charl…" fails,
    // "charlie…" passes.
    const kept = out.slice(0, -1).trim().split(" ");
    const words = original.split(" ");
    expect(kept.every((w, i) => w === words[i])).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
  });

  it("still truncates when there is no space to break on", () => {
    const out = truncateQuote("x".repeat(400), 20);
    expect(out).toHaveLength(21); // 20 + ellipsis
  });
});

describe("buildReadingCard", () => {
  it("computes progress as a percentage", () => {
    expect(buildReadingCard(stats).percent).toBe(25);
  });

  it("never shows more than 100% when the page overruns the count", () => {
    // A stale page number from an old ingest shouldn't produce "103% read".
    expect(buildReadingCard({ ...stats, currentPage: 205 }).percent).toBe(100);
  });

  it("survives a book whose page count is unknown", () => {
    const card = buildReadingCard({ ...stats, pageCount: 0 });
    expect(card.percent).toBe(0);
    expect(card.progressLabel).toBe("page 50");
  });

  it("puts progress first among the stats", () => {
    expect(buildReadingCard(stats).stats[0]).toEqual({ value: "25%", label: "read" });
  });

  it("omits stats that are zero rather than showing an empty brag", () => {
    const card = buildReadingCard({ ...stats, highlightCount: 0, noteCount: 0 });
    expect(card.stats).toHaveLength(1);
  });

  it("pluralizes correctly for a single highlight", () => {
    const card = buildReadingCard({ ...stats, highlightCount: 1, noteCount: 0 });
    expect(card.stats[1]).toEqual({ value: "1", label: "highlight" });
  });

  it("carries the quote and picks a size for it", () => {
    const card = buildReadingCard(stats, { text: "You have power over your mind.", page: 42 });
    expect(card.quote).toEqual({ text: "You have power over your mind.", page: 42 });
    expect(card.quoteSize).toBe(64);
  });

  it("renders without a quote when nothing was highlighted", () => {
    expect(buildReadingCard(stats, null).quote).toBeNull();
  });

  it("drops a whitespace-only quote instead of showing empty quotation marks", () => {
    expect(buildReadingCard(stats, { text: "   \n ", page: 4 }).quote).toBeNull();
  });

  it("falls back to a placeholder title rather than rendering a blank card", () => {
    expect(buildReadingCard({ ...stats, title: "  " }).title).toBe("Untitled");
  });

  it("treats a missing author as absent, not as the string 'undefined'", () => {
    expect(buildReadingCard({ ...stats, author: undefined }).author).toBeNull();
  });
});
