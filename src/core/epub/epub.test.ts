import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseEpub } from "./parseEpub.js";
import { createEpubTextExtractor, readEpubMetadata } from "./extractEpubPages.js";

const fixture = new Uint8Array(
  readFileSync(new URL("./__fixtures__/sample.epub", import.meta.url)),
);

describe("parseEpub (over a real EPUB fixture)", () => {
  it("reads the title from the OPF metadata", () => {
    const { title } = parseEpub(fixture);
    expect(title).toBe("The Nature of the Forms");
  });

  it("returns chapters in spine order", () => {
    const { chapters } = parseEpub(fixture);
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toContain("Theory of Forms");
    expect(chapters[1]).toContain("Paragraph 1");
  });

  it("resolves nested spine hrefs (text/ch2.xhtml) and strips scripts", () => {
    const { chapters } = parseEpub(fixture);
    // ch1 had a <script> — it must not leak into the text.
    expect(chapters[0]).not.toContain("should be stripped");
    // ch2 lives under a subfolder referenced from the OPF dir.
    expect(chapters[1]).toContain("recollects the Forms");
  });

  it("decodes entities in extracted text", () => {
    const { chapters } = parseEpub(fixture);
    expect(chapters[0]).toContain("Chapter One"); // &#160; → space
    expect(chapters[0]).toContain("—"); // &mdash;
  });

  it("throws a corrupt error on non-EPUB bytes", () => {
    expect(() => parseEpub(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe("createEpubTextExtractor", () => {
  it("produces sequentially numbered synthetic pages", async () => {
    const pages = await createEpubTextExtractor().extractPages(fixture);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]!.page).toBe(1);
    pages.forEach((p, i) => expect(p.page).toBe(i + 1));
    // The long second chapter should have paginated into several pages.
    expect(pages.length).toBeGreaterThan(2);
  });
});

describe("readEpubMetadata", () => {
  it("reports the title and a synthetic page count matching the extractor", async () => {
    const meta = await readEpubMetadata(fixture);
    const pages = await createEpubTextExtractor().extractPages(fixture);
    expect(meta.title).toBe("The Nature of the Forms");
    expect(meta.pageCount).toBe(pages.length);
  });
});
