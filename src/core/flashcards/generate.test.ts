import { describe, it, expect } from "vitest";
import {
  parseFlashcards,
  normalizeCard,
  buildFlashcardMessages,
  hasKeptContent,
} from "./generate.js";
import type { KeptContent } from "./generate.js";

describe("parseFlashcards", () => {
  it("parses a clean JSON array", () => {
    const cards = parseFlashcards('[{"front":"What is the soul?","back":"The self."}]');
    expect(cards).toEqual([{ front: "What is the soul?", back: "The self." }]);
  });

  it("tolerates code fences and surrounding prose", () => {
    const text = 'Here are your cards:\n```json\n[{"front":"Q1","back":"A1"}]\n```\nEnjoy!';
    expect(parseFlashcards(text)).toEqual([{ front: "Q1", back: "A1" }]);
  });

  it("accepts alternate key names (question/answer, q/a)", () => {
    const cards = parseFlashcards('[{"question":"Q","answer":"A"},{"q":"Q2","a":"A2"}]');
    expect(cards).toEqual([
      { front: "Q", back: "A" },
      { front: "Q2", back: "A2" },
    ]);
  });

  it("drops malformed / empty items and de-duplicates by front", () => {
    const text = '[{"front":"Dup","back":"x"},{"front":" ","back":"y"},{"front":"Dup","back":"z"},{"back":"no front"}]';
    expect(parseFlashcards(text)).toEqual([{ front: "Dup", back: "x" }]);
  });

  it("returns [] for unparseable input", () => {
    expect(parseFlashcards("sorry, I can't help with that")).toEqual([]);
    expect(parseFlashcards("[not json]")).toEqual([]);
  });

  it("caps the number of cards", () => {
    const many = JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` })));
    expect(parseFlashcards(many, 10)).toHaveLength(10);
  });
});

describe("normalizeCard", () => {
  it("trims and length-caps", () => {
    const card = normalizeCard({ front: "  Q  ", back: "b".repeat(3000) })!;
    expect(card.front).toBe("Q");
    expect(card.back.length).toBeLessThanOrEqual(2001);
    expect(card.back.endsWith("…")).toBe(true);
  });

  it("returns null when a side is missing", () => {
    expect(normalizeCard({ front: "only front" })).toBeNull();
    expect(normalizeCard(null)).toBeNull();
  });
});

describe("buildFlashcardMessages / hasKeptContent", () => {
  const kept: KeptContent = {
    bookTitle: "The Republic",
    highlights: ["Justice is doing one's own work."],
    answers: [{ question: "What are the Forms?", text: "Abstract ideals." }],
    notes: ["Revisit the cave."],
  };

  it("includes the title and all kept material, and asks for JSON", () => {
    const msgs = buildFlashcardMessages(kept, 8);
    expect(msgs[0]!.role).toBe("system");
    expect(msgs[0]!.content).toMatch(/JSON array/i);
    expect(msgs[0]!.content).toContain("up to 8");
    const user = msgs[1]!.content;
    expect(user).toContain("The Republic");
    expect(user).toContain("Justice is doing one's own work.");
    expect(user).toContain("What are the Forms?");
    expect(user).toContain("Revisit the cave.");
  });

  it("detects empty kept content", () => {
    expect(hasKeptContent(kept)).toBe(true);
    expect(hasKeptContent({ bookTitle: "x", highlights: [], answers: [], notes: [] })).toBe(false);
  });
});
