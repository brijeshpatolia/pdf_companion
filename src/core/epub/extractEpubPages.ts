import type { PageText, PdfTextPort } from "../ingestion/types.js";
import type { PdfMetadata } from "../library/types.js";
import { parseEpub } from "./parseEpub.js";
import { paginateChapters } from "./paginate.js";

/**
 * Text extractor for EPUBs, shaped like the PDF one (`PdfTextPort`) so the
 * ingestion pipeline is format-agnostic. Chapters are split into fixed-size
 * synthetic pages that stand in for the pages the format doesn't have.
 */
export function createEpubTextExtractor(): PdfTextPort {
  return {
    async extractPages(bytes) {
      const { chapters } = parseEpub(bytes);
      const pages = paginateChapters(chapters);
      return pages.map((text, i): PageText => ({ page: i + 1, text }));
    },
  };
}

/** Reads title + synthetic page count from EPUB bytes at upload time. */
export async function readEpubMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  const { title, chapters } = parseEpub(bytes);
  const pageCount = paginateChapters(chapters).length;
  return { title, pageCount };
}
