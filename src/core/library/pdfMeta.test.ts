import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readPdfMetadata } from "./pdfMeta.js";

const fixtureBytes = new Uint8Array(
  readFileSync(fileURLToPath(new URL("./__fixtures__/three-page.pdf", import.meta.url))),
);

describe("readPdfMetadata (pdfjs-dist adapter)", () => {
  it("reads the page count and embedded title from a real PDF", async () => {
    const meta = await readPdfMetadata(fixtureBytes);

    // known values baked into scripts/gen-pdf-fixture.mjs
    expect(meta.pageCount).toBe(3);
    expect(meta.title).toBe("Fixture: Three Page Book");
  });
});
