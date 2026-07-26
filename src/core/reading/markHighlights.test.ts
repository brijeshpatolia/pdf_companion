import { describe, it, expect } from "vitest";
import { markHighlights, findRanges, mergeRanges, escapeHtml } from "./markHighlights.js";

describe("escapeHtml", () => {
  it("neutralizes markup from the uploaded file", () => {
    // customTextRenderer's return value becomes innerHTML, and a PDF's text is
    // not a trustworthy source.
    expect(escapeHtml('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });

  it("escapes ampersands without double-escaping the entities it just made", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });
});

describe("mergeRanges", () => {
  it("merges overlapping ranges so marks can't nest", () => {
    expect(mergeRanges([{ start: 0, end: 5 }, { start: 3, end: 9 }])).toEqual([
      { start: 0, end: 9 },
    ]);
  });

  it("joins ranges that merely touch", () => {
    expect(mergeRanges([{ start: 0, end: 4 }, { start: 4, end: 8 }])).toEqual([
      { start: 0, end: 8 },
    ]);
  });

  it("keeps genuinely separate ranges apart", () => {
    const r = [{ start: 0, end: 3 }, { start: 8, end: 12 }];
    expect(mergeRanges(r)).toEqual(r);
  });

  it("sorts before merging", () => {
    expect(mergeRanges([{ start: 8, end: 12 }, { start: 0, end: 3 }])).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 12 },
    ]);
  });

  it("handles nothing", () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

describe("findRanges", () => {
  it("finds a highlight inside a longer line", () => {
    const text = "Socrates said the unexamined life is not worth living, and left.";
    const [r] = findRanges(text, ["the unexamined life"]);
    expect(text.slice(r!.start, r!.end)).toBe("the unexamined life");
  });

  it("matches despite case and spacing differences", () => {
    // A PDF text layer rarely spaces things the way the selection did.
    const text = "The   Unexamined\nLife";
    expect(findRanges(text, ["the unexamined life"])).toHaveLength(1);
  });

  it("marks a whole fragment that sits inside a longer highlight", () => {
    // One highlighted sentence is usually split across several text items.
    const text = "unexamined life";
    const [r] = findRanges(text, ["Socrates said the unexamined life is not worth living"]);
    expect(r).toEqual({ start: 0, end: text.length });
  });

  it("finds the same highlight twice on one page", () => {
    expect(findRanges("justice, and justice again", ["justice"])).toHaveLength(2);
  });

  it("ignores a fragment too short to mean anything", () => {
    // "a" appears inside almost every highlight; marking it would stripe the page.
    expect(findRanges("a", ["a long highlight containing the letter a"])).toEqual([]);
  });

  it("returns nothing when the highlight isn't on this line", () => {
    expect(findRanges("nothing relevant here", ["the unexamined life"])).toEqual([]);
  });

  it("returns nothing for blank text or no highlights", () => {
    expect(findRanges("   ", ["x"])).toEqual([]);
    expect(findRanges("some text", [])).toEqual([]);
  });

  it("ignores a whitespace-only highlight rather than matching everything", () => {
    expect(findRanges("some text", ["   "])).toEqual([]);
  });
});

describe("markHighlights", () => {
  it("wraps the matched part and leaves the rest alone", () => {
    const out = markHighlights("before the unexamined life after", ["the unexamined life"]);
    expect(out).toBe('before <mark class="hl-mine">the unexamined life</mark> after');
  });

  it("escapes text it doesn't mark", () => {
    expect(markHighlights("a < b", [])).toBe("a &lt; b");
  });

  it("escapes the marked text too", () => {
    const out = markHighlights("<b>bold</b>", ["<b>bold</b>"]);
    expect(out).toContain("&lt;b&gt;");
    expect(out).not.toContain("<b>");
  });

  it("never nests marks when highlights overlap", () => {
    const out = markHighlights("the unexamined life", [
      "the unexamined",
      "unexamined life",
    ]);
    expect(out.match(/<mark/g)).toHaveLength(1);
  });

  it("preserves the original text exactly once markup is stripped", () => {
    const text = "Socrates said the unexamined life is not worth living.";
    const stripped = markHighlights(text, ["unexamined life"])
      .replace(/<\/?mark[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    expect(stripped).toBe(text);
  });

  it("leaves a line with no highlights untouched", () => {
    expect(markHighlights("plain line", ["something else"])).toBe("plain line");
  });
});

describe("two highlight species", () => {
  it("marks a peer's highlight with its own class", () => {
    const out = markHighlights("alpha bravo charlie", [], ["bravo"]);
    expect(out).toContain('<mark class="hl-peer">bravo</mark>');
  });

  it("keeps yours and theirs distinguishable on one line", () => {
    const out = markHighlights("alpha bravo charlie delta", ["alpha"], ["charlie"]);
    expect(out).toContain('class="hl-mine">alpha<');
    expect(out).toContain('class="hl-peer">charlie<');
  });

  it("lets your mark win where both cover the same words", () => {
    // Two translucent marks over each other make a third colour that means
    // nothing, so the overlap is given to one of them outright.
    const out = markHighlights("alpha bravo charlie", ["bravo"], ["bravo"]);
    expect(out.match(/<mark/g)).toHaveLength(1);
    expect(out).toContain("hl-mine");
    expect(out).not.toContain("hl-peer");
  });

  it("keeps the part of a peer's highlight yours doesn't cover", () => {
    const out = markHighlights("alpha bravo charlie", ["alpha"], ["alpha bravo"]);
    expect(out).toContain("hl-mine");
    expect(out).toContain("hl-peer");
    // Still exactly the original text once markup is stripped.
    expect(out.replace(/<\/?mark[^>]*>/g, "")).toBe("alpha bravo charlie");
  });

  it("behaves as before when there are no peers", () => {
    expect(markHighlights("alpha bravo", ["bravo"])).toBe(
      'alpha <mark class="hl-mine">bravo</mark>',
    );
  });
});
