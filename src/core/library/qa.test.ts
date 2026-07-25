import { describe, it, expect } from "vitest";
import { buildLibraryQaMessages, collectSources, MAX_PASSAGES } from "./qa.js";
import type { LibraryPassage } from "./qa.js";

function p(over: Partial<LibraryPassage>): LibraryPassage {
  return { bookId: "b1", bookTitle: "The Republic", page: 1, text: "text", score: 0.9, ...over };
}

describe("buildLibraryQaMessages", () => {
  it("puts a system prompt first and the question as the user turn", () => {
    const msgs = buildLibraryQaMessages("  What is justice?  ", [p({})]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe("system");
    expect(msgs[1]).toEqual({ role: "user", content: "What is justice?" });
  });

  it("numbers passages and labels them with book title and page", () => {
    const msgs = buildLibraryQaMessages("q", [
      p({ bookTitle: "The Republic", page: 12, text: "A" }),
      p({ bookId: "b2", bookTitle: "Meditations", page: 3, text: "B" }),
    ]);
    const sys = msgs[0]!.content;
    expect(sys).toContain("[1] The Republic — p. 12");
    expect(sys).toContain("[2] Meditations — p. 3");
    expect(sys).toContain("cite it inline as (Book title, p. N)");
  });

  it("notes when no passages were found", () => {
    const sys = buildLibraryQaMessages("q", [])[0]!.content;
    expect(sys).toContain("no relevant passages");
  });

  it("caps the passages fed to the model", () => {
    const many = Array.from({ length: 20 }, (_, i) => p({ page: i + 1, text: `T${i}` }));
    const sys = buildLibraryQaMessages("q", many)[0]!.content;
    expect(sys).toContain(`[${MAX_PASSAGES}]`);
    expect(sys).not.toContain(`[${MAX_PASSAGES + 1}]`);
  });
});

describe("collectSources", () => {
  it("groups by book in best-match order, de-duping and sorting pages", () => {
    const sources = collectSources([
      p({ bookId: "b1", bookTitle: "The Republic", page: 40 }),
      p({ bookId: "b2", bookTitle: "Meditations", page: 5 }),
      p({ bookId: "b1", bookTitle: "The Republic", page: 12 }),
      p({ bookId: "b1", bookTitle: "The Republic", page: 40 }), // dupe page
    ]);
    expect(sources).toEqual([
      { bookId: "b1", bookTitle: "The Republic", pages: [12, 40] },
      { bookId: "b2", bookTitle: "Meditations", pages: [5] },
    ]);
  });

  it("returns an empty list for no passages", () => {
    expect(collectSources([])).toEqual([]);
  });
});
