import { describe, it, expect } from "vitest";
import { buildSharedBook } from "./buildSharedBook.js";

const base = {
  bookTitle: "The Republic",
  highlights: [],
  answers: [],
  notes: [],
  flashcards: [],
};

describe("buildSharedBook", () => {
  it("marks an empty book as empty with zeroed counts", () => {
    const s = buildSharedBook({ ...base });
    expect(s.isEmpty).toBe(true);
    expect(s.counts).toEqual({ highlights: 0, answers: 0, notes: 0, flashcards: 0 });
  });

  it("orders highlights and answers by page, breaking ties by createdAt", () => {
    const s = buildSharedBook({
      ...base,
      highlights: [
        { page: 30, text: "c", createdAt: "2026-01-03" },
        { page: 10, text: "a", createdAt: "2026-01-01" },
        { page: 10, text: "b", createdAt: "2026-01-02" },
      ],
      answers: [
        { page: 5, question: "Q2", text: "second", createdAt: "2026-02-02" },
        { page: 2, question: "Q1", text: "first", createdAt: "2026-02-01" },
      ],
    });
    expect(s.highlights.map((h) => h.text)).toEqual(["a", "b", "c"]);
    expect(s.answers.map((a) => a.text)).toEqual(["first", "second"]);
    expect(s.isEmpty).toBe(false);
  });

  it("orders notes newest-first by updatedAt", () => {
    const s = buildSharedBook({
      ...base,
      notes: [
        { page: 1, text: "older", updatedAt: "2026-03-01T10:00:00Z" },
        { page: null, text: "newer", updatedAt: "2026-03-05T10:00:00Z" },
      ],
    });
    expect(s.notes.map((n) => n.text)).toEqual(["newer", "older"]);
  });

  it("passes flashcards through and counts everything", () => {
    const s = buildSharedBook({
      ...base,
      highlights: [{ page: 1, text: "h", createdAt: "2026-01-01" }],
      flashcards: [
        { front: "What is justice?", back: "Harmony of the soul." },
        { front: "Who is Glaucon?", back: "Plato's brother." },
      ],
    });
    expect(s.flashcards).toHaveLength(2);
    expect(s.counts).toEqual({ highlights: 1, answers: 0, notes: 0, flashcards: 2 });
  });

  it("caps each section at 500 items", () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      page: i,
      text: `h${i}`,
      createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`,
    }));
    const s = buildSharedBook({ ...base, highlights: many });
    expect(s.highlights).toHaveLength(500);
    expect(s.counts.highlights).toBe(500);
  });

  it("falls back to 'Untitled' for a blank title", () => {
    expect(buildSharedBook({ ...base, bookTitle: "   " }).bookTitle).toBe("Untitled");
  });

  it("does not mutate the input arrays", () => {
    const highlights = [
      { page: 2, text: "b", createdAt: "2026-01-02" },
      { page: 1, text: "a", createdAt: "2026-01-01" },
    ];
    buildSharedBook({ ...base, highlights });
    expect(highlights.map((h) => h.text)).toEqual(["b", "a"]);
  });
});
