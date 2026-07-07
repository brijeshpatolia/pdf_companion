import type { PdfMetadata } from "./types.js";
// Legacy build runs in Node without a browser worker; we only read metadata
// (page count + document info), so no canvas/font rendering is needed.
// @ts-expect-error - the legacy subpath ships no type declarations
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Real PdfMetaPort adapter. Reads page count and embedded title from PDF bytes
 * using the same PDF.js family the reader renders with (PRD decision 3).
 */
export async function readPdfMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  const doc = await getDocument({ data: bytes, isEvalSupported: false }).promise;
  try {
    const pageCount: number = doc.numPages;
    const { info } = await doc.getMetadata();
    const rawTitle: unknown = (info as { Title?: unknown }).Title;
    const title =
      typeof rawTitle === "string" && rawTitle.trim() !== "" ? rawTitle : null;
    return { pageCount, title };
  } finally {
    await doc.destroy();
  }
}
