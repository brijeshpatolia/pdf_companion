import type { IngestDeps, IngestEvent } from "./types.js";

export async function* ingest(
  bookId: string,
  deps: IngestDeps,
): AsyncGenerator<IngestEvent> {
  await deps.books.updateStatus(bookId, "processing");
  yield { type: "status", status: "processing" };

  const fileRef = await deps.books.getFileRef(bookId);
  const bytes = await deps.storage.download(fileRef);

  let pages;
  try {
    pages = await deps.pdfText.extractPages(bytes);
  } catch (err: unknown) {
    const code = (err as any)?.code === "encrypted" ? "encrypted" as const : "corrupt" as const;
    const message = err instanceof Error ? err.message : "Failed to extract text";
    await deps.books.updateStatus(bookId, "failed");
    yield { type: "error", code, message };
    yield { type: "status", status: "failed" };
    return;
  }

  const nonEmpty = pages.filter((p) => p.text.trim().length > 0);
  if (nonEmpty.length === 0) {
    await deps.books.updateStatus(bookId, "failed");
    yield { type: "error", code: "no-text", message: "This PDF contains no extractable text. It may be a scanned document — OCR is not yet supported." };
    yield { type: "status", status: "failed" };
    return;
  }

  const totalPages = nonEmpty.length;
  for (const p of nonEmpty) {
    yield { type: "progress", page: p.page, totalPages };
  }

  const texts = nonEmpty.map((p) => p.text);
  const embeddings = await deps.embedder.embed(texts);

  const chunks = nonEmpty.map((p, i) => ({
    bookId,
    page: p.page,
    text: p.text,
    embedding: embeddings[i]!,
  }));

  await deps.chunks.deleteByBook(bookId);
  await deps.chunks.upsert(bookId, chunks);

  await deps.books.updateStatus(bookId, "ready");
  yield { type: "status", status: "ready" };
}
