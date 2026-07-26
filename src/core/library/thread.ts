/**
 * The Ask-your-library thread.
 *
 * A stored conversation is a flat list of rows in time order; what the screen
 * needs is exchanges — a question with the answer it got and the pages that
 * answer was drawn from. Folding one into the other is the only real logic
 * here, and it has to survive a history that isn't tidy: a question whose
 * answer never arrived because the request failed, or an answer with no
 * question because a row was deleted.
 */

export interface Source {
  bookId: string;
  bookTitle: string;
  pages: number[];
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[] | null;
  created_at?: string;
}

export interface Exchange {
  id: string;
  question: string;
  /** Absent while an answer is still streaming, or if it never arrived. */
  answer?: string;
  sources: Source[];
  /** True when the question was asked but no answer was ever stored. */
  unanswered: boolean;
}

/**
 * Folds stored messages into question-and-answer pairs.
 *
 * Pairs are formed by adjacency in time, which is what the writer guarantees:
 * the question is written before the request runs and the answer immediately
 * after it finishes.
 */
export function toExchanges(messages: StoredMessage[]): Exchange[] {
  const out: Exchange[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({
        id: message.id,
        question: message.content,
        sources: [],
        unanswered: true,
      });
      continue;
    }

    const open = out[out.length - 1];
    // An answer with no question in front of it would otherwise be dropped
    // silently. Better to show it attached to an empty question than to lose
    // something the reader paid for.
    if (!open || !open.unanswered) {
      out.push({
        id: message.id,
        question: "",
        answer: message.content,
        sources: message.sources ?? [],
        unanswered: false,
      });
      continue;
    }

    open.answer = message.content;
    open.sources = message.sources ?? [];
    open.unanswered = false;
  }

  return out;
}

/** Newest first — the thread reads downward from the field you just typed in. */
export function newestFirst(exchanges: Exchange[]): Exchange[] {
  return [...exchanges].reverse();
}

/**
 * Sources as stored. Anything that doesn't carry a book and at least one page
 * is dropped rather than rendered as a citation to nowhere.
 */
export function parseSources(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];
  const out: Source[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { bookId, bookTitle, pages } = item as Record<string, unknown>;
    if (typeof bookId !== "string" || !bookId) continue;
    if (typeof bookTitle !== "string") continue;
    const cleanPages = Array.isArray(pages)
      ? pages.filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p >= 1)
      : [];
    if (cleanPages.length === 0) continue;
    out.push({ bookId, bookTitle, pages: cleanPages });
  }
  return out;
}
