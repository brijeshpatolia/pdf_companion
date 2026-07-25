/**
 * Cross-book Q&A: build the prompt for a question answered from passages drawn
 * across the reader's whole library, and collect the passages into a tidy list
 * of sources for citation. Pure, so both are easy to test; the route wires in
 * retrieval, the gateway, and streaming.
 */

export interface LibraryPassage {
  bookId: string;
  bookTitle: string;
  page: number;
  text: string;
  score: number;
}

export interface LibraryQaSource {
  bookId: string;
  bookTitle: string;
  pages: number[];
}

export interface QaMessage {
  role: "system" | "user";
  content: string;
}

/** Cap on how many passages are fed to the model (and shown as sources). */
export const MAX_PASSAGES = 12;

export function buildLibraryQaMessages(question: string, passages: LibraryPassage[]): QaMessage[] {
  const used = passages.slice(0, MAX_PASSAGES);
  const context = used.length
    ? used.map((p, i) => `[${i + 1}] ${p.bookTitle} — p. ${p.page}\n${p.text.trim()}`).join("\n\n")
    : "(no relevant passages were found in the reader's library)";

  const system = [
    "You are a research companion answering a question using excerpts drawn from the reader's personal library of books.",
    "Ground every claim in the excerpts below. When you draw on one, cite it inline as (Book title, p. N).",
    "Where the books speak to each other, draw the connection out. If the excerpts don't contain enough to answer, say so plainly instead of inventing an answer.",
    "",
    "Excerpts:",
    context,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: question.trim() },
  ];
}

/**
 * Group passages into one entry per book (in order of first appearance, i.e.
 * best match first), with that book's cited pages de-duplicated and sorted.
 */
export function collectSources(passages: LibraryPassage[]): LibraryQaSource[] {
  const byBook = new Map<string, LibraryQaSource>();
  for (const p of passages.slice(0, MAX_PASSAGES)) {
    let source = byBook.get(p.bookId);
    if (!source) {
      source = { bookId: p.bookId, bookTitle: p.bookTitle, pages: [] };
      byBook.set(p.bookId, source);
    }
    if (!source.pages.includes(p.page)) source.pages.push(p.page);
  }
  return [...byBook.values()].map((s) => ({ ...s, pages: [...s.pages].sort((a, b) => a - b) }));
}
