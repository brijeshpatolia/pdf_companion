import { describe, it, expect } from "vitest";
import { normalizeTitle, findOwnCopy } from "./matchBook.js";

const lib = (...titles: string[]) => titles.map((title, i) => ({ id: `b${i}`, title }));

describe("normalizeTitle", () => {
  it("ignores case, punctuation, and spacing", () => {
    expect(normalizeTitle("  The  Republic, of Plato! ")).toBe(normalizeTitle("the republic of plato"));
  });

  it("drops a leading article so 'The Republic' matches 'Republic'", () => {
    expect(normalizeTitle("The Republic")).toBe(normalizeTitle("Republic"));
  });

  it("normalizes curly quotes to nothing", () => {
    expect(normalizeTitle("Plato’s Republic")).toBe("platos republic");
  });
});

describe("findOwnCopy", () => {
  it("finds an exact match", () => {
    const books = lib("Meditations", "The Republic");
    expect(findOwnCopy(books, "Meditations")?.id).toBe("b0");
  });

  it("matches across the punctuation differences between sources", () => {
    const books = lib("The Republic of Plato");
    expect(findOwnCopy(books, "the republic of plato")?.id).toBe("b0");
  });

  it("matches when one source appends a subtitle", () => {
    // Gutenberg and the Internet Archive title the same work differently.
    const books = lib("A Vindication of the Rights of Woman");
    const wanted = "A Vindication of the Rights of Woman / With Strictures on Political and Moral Subjects";
    expect(findOwnCopy(books, wanted)?.id).toBe("b0");
  });

  it("matches when the joiner's copy is the one with the subtitle", () => {
    const books = lib("Meditations: A New Translation");
    expect(findOwnCopy(books, "Meditations")?.id).toBe("b0");
  });

  it("prefers an exact match over a subtitle match", () => {
    const books = lib("Meditations: A New Translation", "Meditations");
    expect(findOwnCopy(books, "Meditations")?.id).toBe("b1");
  });

  it("returns null when the reader doesn't have the book", () => {
    expect(findOwnCopy(lib("Meditations"), "Leviathan")).toBeNull();
  });

  it("returns null for an empty library", () => {
    expect(findOwnCopy([], "Meditations")).toBeNull();
  });

  it("does not match everything when the wanted title is blank", () => {
    // A blank title must not silently pair the joiner with an arbitrary book.
    expect(findOwnCopy(lib("Meditations"), "   ")).toBeNull();
  });

  it("does not confuse two different works sharing a first word", () => {
    const books = lib("Meditations on First Philosophy");
    expect(findOwnCopy(books, "Meditations")).toBeNull();
  });
});
