import { describe, it, expect } from "vitest";
import { saveItem, listSavedItems, removeSavedItem } from "./saved.js";
import type { NewSavedItem, SavedItem, SavedItemsPort } from "./types.js";

function fakeSavedStore(): SavedItemsPort {
  const items: SavedItem[] = [];
  let nextId = 1;
  return {
    async insert(item: NewSavedItem) {
      const saved: SavedItem = {
        ...item,
        id: `item-${nextId++}`,
        createdAt: new Date().toISOString(),
      };
      items.push(saved);
      return saved;
    },
    async listByBook(bookId) {
      return items.filter((i) => i.bookId === bookId);
    },
    async remove(id) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
}

const HIGHLIGHT: NewSavedItem = {
  bookId: "book-1",
  kind: "highlight",
  page: 12,
  text: "The unexamined life is not worth living.",
};

describe("saveItem", () => {
  it("stores a highlight and returns it with an id", async () => {
    const port = fakeSavedStore();
    const saved = await saveItem(HIGHLIGHT, port);

    expect(saved.id).toBeTruthy();
    expect(saved.kind).toBe("highlight");
    expect(saved.page).toBe(12);
    expect(await listSavedItems("book-1", port)).toHaveLength(1);
  });

  it("stores a saved answer with its question", async () => {
    const port = fakeSavedStore();
    const saved = await saveItem(
      {
        bookId: "book-1",
        kind: "answer",
        page: 30,
        text: "The Forms are abstract ideals.",
        question: "  What are the Forms?  ",
      },
      port,
    );

    expect(saved.question).toBe("What are the Forms?");
  });

  it("trims text and rejects empty selections", async () => {
    const port = fakeSavedStore();
    await expect(
      saveItem({ ...HIGHLIGHT, text: "   " }, port),
    ).rejects.toThrow(/empty/);
  });

  it("rejects invalid pages", async () => {
    const port = fakeSavedStore();
    await expect(saveItem({ ...HIGHLIGHT, page: 0 }, port)).rejects.toThrow(/page/);
    await expect(saveItem({ ...HIGHLIGHT, page: 2.5 }, port)).rejects.toThrow(/page/);
  });

  it("rejects unknown kinds", async () => {
    const port = fakeSavedStore();
    await expect(
      saveItem({ ...HIGHLIGHT, kind: "doodle" as never }, port),
    ).rejects.toThrow(/kind/);
  });

  it("clips very long selections to a bounded size", async () => {
    const port = fakeSavedStore();
    const saved = await saveItem({ ...HIGHLIGHT, text: "x".repeat(9000) }, port);
    expect(saved.text.length).toBeLessThanOrEqual(5001);
    expect(saved.text.endsWith("…")).toBe(true);
  });

  it("saving the identical item twice returns the existing one", async () => {
    const port = fakeSavedStore();
    const first = await saveItem(HIGHLIGHT, port);
    const second = await saveItem(HIGHLIGHT, port);

    expect(second.id).toBe(first.id);
    expect(await listSavedItems("book-1", port)).toHaveLength(1);
  });

  it("same text on a different page is a distinct item", async () => {
    const port = fakeSavedStore();
    await saveItem(HIGHLIGHT, port);
    await saveItem({ ...HIGHLIGHT, page: 13 }, port);

    expect(await listSavedItems("book-1", port)).toHaveLength(2);
  });
});

describe("removeSavedItem", () => {
  it("removes an item by id", async () => {
    const port = fakeSavedStore();
    const saved = await saveItem(HIGHLIGHT, port);
    await removeSavedItem(saved.id, port);

    expect(await listSavedItems("book-1", port)).toHaveLength(0);
  });
});
