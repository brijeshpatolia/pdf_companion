/**
 * Finding a joiner's own copy of the room's book.
 *
 * A room is shared by link, and the app never redistributes book files — so
 * every participant reads their *own* copy, which is a different `books` row
 * with a different id. The only thing the two rows reliably have in common is
 * the title, and even that varies by source: Project Gutenberg and the Internet
 * Archive publish the same work under titles that differ in subtitle,
 * punctuation, and case.
 *
 * So this is a heuristic, and it's meant to be: match on a normalized title,
 * and treat a leading segment before a subtitle separator as good enough. A
 * miss is not damaging — the joiner is simply offered the book to add.
 */

export interface TitledBook {
  id: string;
  title: string;
}

/** Lowercase, strip punctuation and articles, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[‘’“”]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      // Strip the article only once the string is trimmed and collapsed, or a
      // leading space hides it.
      .replace(/^(the|a|an) /, "")
  );
}

/**
 * The part before a subtitle separator — "Meditations / Translated by…" and
 * "Meditations: A New Translation" both reduce to "meditations".
 */
function mainTitle(title: string): string {
  // Whitespace around the separator is optional: sources write both
  // "Woman / With Strictures" and "Meditations: A New Translation".
  const cut = title.split(/\s*[/:;—–|]\s*/)[0] ?? title;
  return normalizeTitle(cut);
}

/**
 * The joiner's copy of `wantedTitle`, or null if they don't have it.
 * Exact normalized match wins; a main-title match is the fallback.
 */
export function findOwnCopy<T extends TitledBook>(books: T[], wantedTitle: string): T | null {
  const wantedFull = normalizeTitle(wantedTitle);
  if (!wantedFull) return null;

  const exact = books.find((b) => normalizeTitle(b.title) === wantedFull);
  if (exact) return exact;

  const wantedMain = mainTitle(wantedTitle);
  if (!wantedMain) return null;
  return books.find((b) => mainTitle(b.title) === wantedMain) ?? null;
}
