import { describe, it, expect } from "vitest";
import { createPageCache } from "./pageCache.js";

describe("createPageCache", () => {
  it("gives back what it was given", () => {
    const cache = createPageCache<string>(4);
    cache.set("b:1", "In the beginning");
    expect(cache.get("b:1")).toBe("In the beginning");
    expect(cache.has("b:1")).toBe(true);
  });

  it("knows nothing about a page it hasn't been given", () => {
    const cache = createPageCache<string>(4);
    expect(cache.get("b:9")).toBeUndefined();
    expect(cache.has("b:9")).toBe(false);
  });

  it("holds an empty page, which is not the same as no page", () => {
    // A blank page really is blank, and re-fetching it every turn would be a
    // spinner on a page with nothing to load.
    const cache = createPageCache<string>(4);
    cache.set("b:2", "");
    expect(cache.get("b:2")).toBe("");
    expect(cache.has("b:2")).toBe(true);
  });

  it("never grows past its limit", () => {
    const cache = createPageCache<string>(3);
    for (let page = 1; page <= 10; page++) cache.set(`b:${page}`, `page ${page}`);
    expect(cache.size).toBe(3);
    expect(cache.has("b:10")).toBe(true);
    expect(cache.has("b:1")).toBe(false);
  });

  it("keeps the passage being read, not merely the newest pages", () => {
    // Reading back and forth over two pages is exactly when the cache earns
    // its keep, so reading a page has to count as using it.
    const cache = createPageCache<string>(3);
    cache.set("b:1", "one");
    cache.set("b:2", "two");
    cache.set("b:3", "three");

    cache.get("b:1"); // back to the start of the passage
    cache.set("b:4", "four"); // pushes one out

    expect(cache.has("b:1")).toBe(true);
    expect(cache.has("b:2")).toBe(false);
  });

  it("re-setting a page keeps it, rather than storing it twice", () => {
    const cache = createPageCache<string>(2);
    cache.set("b:1", "one");
    cache.set("b:1", "one, again");
    cache.set("b:2", "two");

    expect(cache.size).toBe(2);
    expect(cache.get("b:1")).toBe("one, again");
  });

  it("holds nothing at all when told to hold nothing", () => {
    for (const limit of [0, -1, NaN]) {
      const cache = createPageCache<string>(limit);
      cache.set("b:1", "one");
      expect(cache.size).toBe(0);
      expect(cache.get("b:1")).toBeUndefined();
    }
  });
});
