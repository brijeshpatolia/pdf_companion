import { describe, it, expect } from "vitest";
import { buildExportMarkdown, exportFilename } from "./buildMarkdown.js";
import type { ExportInput } from "./buildMarkdown.js";

const base: ExportInput = {
  bookTitle: "The Republic",
  exportedAt: "2026-07-24T00:00:00Z",
  highlights: [{ page: 12, text: "The unexamined life is not worth living.", createdAt: "2026-07-20T00:00:00Z" }],
  answers: [{ page: 30, question: "What are the Forms?", text: "Abstract ideals more real than things.", createdAt: "2026-07-21T00:00:00Z" }],
  notes: [{ page: 42, text: "Come back to the cave allegory.", updatedAt: "2026-07-22T00:00:00Z" }],
};

describe("buildExportMarkdown", () => {
  it("includes a title and export date", () => {
    const md = buildExportMarkdown(base);
    expect(md).toContain("# The Republic");
    expect(md).toContain("Exported from Studiolo on 2026-07-24");
  });

  it("renders highlights as blockquotes with page refs", () => {
    const md = buildExportMarkdown(base);
    expect(md).toContain("## Highlights (1)");
    expect(md).toContain("> The unexamined life is not worth living.");
    expect(md).toContain("— p. 12");
  });

  it("renders saved answers with the question as a heading", () => {
    const md = buildExportMarkdown(base);
    expect(md).toContain("## Saved answers (1)");
    expect(md).toContain("### What are the Forms?");
    expect(md).toContain("*p. 30*");
    expect(md).toContain("Abstract ideals more real than things.");
  });

  it("renders notes with page + date", () => {
    const md = buildExportMarkdown(base);
    expect(md).toContain("## Notes (1)");
    expect(md).toContain("**p. 42 · 2026-07-22**");
    expect(md).toContain("Come back to the cave allegory.");
  });

  it("omits empty sections", () => {
    const md = buildExportMarkdown({ ...base, answers: [], notes: [] });
    expect(md).toContain("## Highlights");
    expect(md).not.toContain("## Saved answers");
    expect(md).not.toContain("## Notes");
  });

  it("handles a book with nothing saved", () => {
    const md = buildExportMarkdown({ bookTitle: "Empty", highlights: [], answers: [], notes: [] });
    expect(md).toContain("Nothing saved for this book yet");
  });

  it("uses a fallback heading for an answer with no question, and page-less notes", () => {
    const md = buildExportMarkdown({
      ...base,
      answers: [{ page: 5, text: "an answer", createdAt: "2026-07-21T00:00:00Z" }],
      notes: [{ page: null, text: "book-level thought", updatedAt: "2026-07-22T00:00:00Z" }],
    });
    expect(md).toContain("### Answer");
    expect(md).toContain("**2026-07-22**");
    expect(md).not.toContain("p.  ·");
  });
});

describe("exportFilename", () => {
  it("slugifies the title", () => {
    expect(exportFilename("The Republic")).toBe("the-republic.md");
    expect(exportFilename("A Vindication of the Rights of Woman")).toBe("a-vindication-of-the-rights-of-woman.md");
    expect(exportFilename("  !!!  ")).toBe("book.md");
  });
});
