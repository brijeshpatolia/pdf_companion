import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPdfTextExtractor } from "./extractText.js";

const demoPdf = readFileSync(resolve(__dirname, "__fixtures__/socrates.pdf"));

describe("createPdfTextExtractor", () => {
  const extractor = createPdfTextExtractor();

  it("extracts text from all pages with correct page numbers", async () => {
    const pages = await extractor.extractPages(new Uint8Array(demoPdf));

    expect(pages).toHaveLength(3);
    expect(pages[0]!.page).toBe(1);
    expect(pages[1]!.page).toBe(2);
    expect(pages[2]!.page).toBe(3);
  });

  it("extracts non-empty text from each page", async () => {
    const pages = await extractor.extractPages(new Uint8Array(demoPdf));

    for (const p of pages) {
      expect(p.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("strips standalone page numbers", async () => {
    const pages = await extractor.extractPages(new Uint8Array(demoPdf));

    for (const p of pages) {
      const lines = p.text.split("\n").map((l) => l.trim());
      const standaloneNumbers = lines.filter((l) => /^\d+$/.test(l));
      expect(standaloneNumbers).toEqual([]);
    }
  });
});
