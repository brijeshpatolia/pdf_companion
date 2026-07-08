import type { PdfMetadata } from "./types.js";
// Legacy build runs in Node without a browser worker; we only read metadata
// (page count + document info), so no canvas/font rendering is needed.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Real PdfMetaPort adapter. Reads page count and embedded title from PDF bytes
 * using the same PDF.js family the reader renders with (PRD decision 3).
 */
export async function readPdfMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  // pdfjs transfers (detaches) the ArrayBuffer backing `data`, which would
  // destroy the caller's buffer — later reused to store the file. Hand it a
  // copy so this adapter never mutates its input.
  const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
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
