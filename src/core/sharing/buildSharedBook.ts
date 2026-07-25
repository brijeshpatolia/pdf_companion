/**
 * Shapes a book's kept study material — highlights, saved answers, notes, and
 * flashcards — into a read-only view model for the public share page. Pure, so
 * the ordering, counts, and caps are easy to test; the page just renders it.
 *
 * Note: this deliberately carries only the reader's *own* artifacts (their
 * highlights, the AI answers they saved, their notes and cards) — never the
 * book's full text — so sharing raises no distribution concern.
 */

export interface ShareHighlight {
  page: number;
  text: string;
  createdAt: string;
}
export interface ShareAnswer {
  page: number;
  question?: string;
  text: string;
  createdAt: string;
}
export interface ShareNote {
  page: number | null;
  text: string;
  updatedAt: string;
}
export interface ShareCard {
  front: string;
  back: string;
}

export interface SharedBookInput {
  bookTitle: string;
  sharedAt?: string; // ISO; defaults to now
  highlights: ShareHighlight[];
  answers: ShareAnswer[];
  notes: ShareNote[];
  flashcards: ShareCard[];
}

export interface SharedBook {
  bookTitle: string;
  sharedAt: string;
  isEmpty: boolean;
  counts: { highlights: number; answers: number; notes: number; flashcards: number };
  highlights: { page: number; text: string }[];
  answers: { page: number; question?: string; text: string }[];
  notes: { page: number | null; text: string; updatedAt: string }[];
  flashcards: ShareCard[];
}

// Guardrail so a runaway book can't produce a multi-megabyte public page.
const MAX_PER_SECTION = 500;

export function buildSharedBook(input: SharedBookInput): SharedBook {
  const sharedAt = input.sharedAt ?? new Date().toISOString();

  // Highlights and answers read best in book order (by page).
  const highlights = [...input.highlights]
    .sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt))
    .slice(0, MAX_PER_SECTION)
    .map((h) => ({ page: h.page, text: h.text }));

  const answers = [...input.answers]
    .sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt))
    .slice(0, MAX_PER_SECTION)
    .map((a) => ({ page: a.page, question: a.question, text: a.text }));

  // Notes read best newest-first, matching the in-app Notes tab.
  const notes = [...input.notes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_PER_SECTION)
    .map((n) => ({ page: n.page, text: n.text, updatedAt: n.updatedAt }));

  const flashcards = input.flashcards
    .slice(0, MAX_PER_SECTION)
    .map((c) => ({ front: c.front, back: c.back }));

  const counts = {
    highlights: highlights.length,
    answers: answers.length,
    notes: notes.length,
    flashcards: flashcards.length,
  };

  return {
    bookTitle: input.bookTitle.trim() || "Untitled",
    sharedAt,
    isEmpty:
      counts.highlights === 0 &&
      counts.answers === 0 &&
      counts.notes === 0 &&
      counts.flashcards === 0,
    counts,
    highlights,
    answers,
    notes,
    flashcards,
  };
}
