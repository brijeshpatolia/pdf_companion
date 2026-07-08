import { describe, it, expect } from "vitest";
import { updateReadingProgress, markPagesRead, getProgress } from "./progress.js";
import type { ReadingProgress, ReadingProgressPort } from "./types.js";

function fakeProgressStore(): ReadingProgressPort {
  const store = new Map<string, ReadingProgress>();
  return {
    async load(bookId) {
      return store.get(bookId) ?? null;
    },
    async save(bookId, progress) {
      store.set(bookId, progress);
    },
  };
}

describe("updateReadingProgress", () => {
  it("contiguous forward reading advances furthestReadPage", async () => {
    const port = fakeProgressStore();

    await updateReadingProgress("book-1", 1, port);
    await updateReadingProgress("book-1", 2, port);
    await updateReadingProgress("book-1", 3, port);

    const p = await getProgress("book-1", port);
    expect(p.currentPage).toBe(3);
    expect(p.furthestReadPage).toBe(3);
  });

  it("flipping back never lowers furthestReadPage", async () => {
    const port = fakeProgressStore();

    await updateReadingProgress("book-1", 1, port);
    await updateReadingProgress("book-1", 2, port);
    await updateReadingProgress("book-1", 3, port);
    await updateReadingProgress("book-1", 1, port);

    const p = await getProgress("book-1", port);
    expect(p.currentPage).toBe(1);
    expect(p.furthestReadPage).toBe(3);
  });

  it("jump from p12 to p380 updates currentPage only — furthestReadPage stays 12", async () => {
    const port = fakeProgressStore();

    for (let i = 1; i <= 12; i++) {
      await updateReadingProgress("book-1", i, port);
    }

    await updateReadingProgress("book-1", 380, port);

    const p = await getProgress("book-1", port);
    expect(p.currentPage).toBe(380);
    expect(p.furthestReadPage).toBe(12);
  });

  it("markPagesRead advances furthestReadPage to the given page", async () => {
    const port = fakeProgressStore();

    for (let i = 1; i <= 12; i++) {
      await updateReadingProgress("book-1", i, port);
    }
    await updateReadingProgress("book-1", 380, port);

    await markPagesRead("book-1", 380, port);

    const p = await getProgress("book-1", port);
    expect(p.furthestReadPage).toBe(380);
    expect(p.currentPage).toBe(380);
  });

  it("small forward skip (debounce) still advances furthestReadPage", async () => {
    const port = fakeProgressStore();

    await updateReadingProgress("book-1", 1, port);
    // debounce skips page 2, reports page 3 directly
    await updateReadingProgress("book-1", 3, port);

    const p = await getProgress("book-1", port);
    expect(p.currentPage).toBe(3);
    expect(p.furthestReadPage).toBe(3);
  });

  it("reopen lands on saved currentPage", async () => {
    const port = fakeProgressStore();

    await updateReadingProgress("book-1", 1, port);
    await updateReadingProgress("book-1", 2, port);

    const p = await getProgress("book-1", port);
    expect(p.currentPage).toBe(2);
  });
});
