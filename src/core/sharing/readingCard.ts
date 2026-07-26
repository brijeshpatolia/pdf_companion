/**
 * The shareable reading card — the thing you post, not the thing you read.
 *
 * Strava's share image works because it shows the *shape of the effort*: the
 * map is unique to that run, and it's the map people recognise. Reading has no
 * map. What it has is the sentence that stopped you — so the quote is the
 * hero here, and progress is the supporting number.
 *
 * This module makes every decision that has a right answer, so the renderer
 * only has to draw. That includes the awkward one: a quote long enough to fill
 * the card is common, and a quote that overflows it silently is the difference
 * between something you'd post and something you'd delete.
 */

export interface CardStats {
  title: string;
  author?: string;
  currentPage: number;
  pageCount: number;
  highlightCount: number;
  noteCount: number;
}

export interface CardQuote {
  text: string;
  page: number;
  /**
   * Whose words these are. A highlight is the author's and gets quotation
   * marks; a note is the reader's own and must not, or a card headed with the
   * book's title turns your sentence into the author's.
   */
  source?: "highlight" | "note";
}

export interface ReadingCard {
  title: string;
  author: string | null;
  /** 0–100, clamped — a card never shows 103% read. */
  percent: number;
  progressLabel: string;
  quote: { text: string; page: number; source: "highlight" | "note" } | null;
  /** Caption under the quote — distinguishes the author's words from yours. */
  quoteCaption: string;
  /** Font size in px, chosen so the quote fills the card without overflowing. */
  quoteSize: number;
  stats: { value: string; label: string }[];
  /**
   * Which element carries the card.
   *
   * With a highlight, the quote is the hero and the title is a credit line.
   * Without one there is nothing to quote, so the title takes the space
   * instead — the alternative is a mostly-empty card with a lonely "page 3 of
   * 390" in the middle, which is not something anyone would post.
   */
  variant: "quote" | "title";
  /** Title size in px — larger when the title is doing the work. */
  titleSize: number;
  eyebrow: string;
}

/** Longer than this and no font size saves it, so it gets an ellipsis. */
const MAX_QUOTE_CHARS = 280;

/**
 * Quote type scales down as the quote gets longer. The thresholds come from
 * the card being 1080px wide with 80px margins: roughly 34 characters per line
 * at 56px, and six lines before it collides with the stats row.
 */
export function quoteFontSize(length: number): number {
  if (length <= 70) return 64;
  if (length <= 120) return 56;
  if (length <= 190) return 46;
  return 38;
}

/** Trims to a whole word, so a shared quote never ends mid-syllable. */
export function truncateQuote(text: string, max = MAX_QUOTE_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Everything the card renderer needs, already decided. */
export function buildReadingCard(stats: CardStats, quote?: CardQuote | null): ReadingCard {
  const pageCount = Math.max(0, Math.floor(stats.pageCount));
  const current = Math.min(Math.max(0, Math.floor(stats.currentPage)), pageCount || Infinity);
  const percent = pageCount > 0 ? Math.min(100, Math.round((current / pageCount) * 100)) : 0;

  const text = quote?.text ? truncateQuote(quote.text) : "";

  const cards: { value: string; label: string }[] = [
    { value: `${percent}%`, label: "read" },
  ];
  if (stats.highlightCount > 0) {
    cards.push({ value: String(stats.highlightCount), label: plural(stats.highlightCount, "highlight").split(" ")[1]! });
  }
  if (stats.noteCount > 0) {
    cards.push({ value: String(stats.noteCount), label: plural(stats.noteCount, "note").split(" ")[1]! });
  }

  const title = stats.title.trim() || "Untitled";

  return {
    title,
    author: stats.author?.trim() || null,
    percent,
    progressLabel: pageCount > 0 ? `page ${current} of ${pageCount}` : `page ${current}`,
    quote: text ? { text, page: quote!.page, source: quote!.source ?? "highlight" } : null,
    quoteCaption: !text
      ? ""
      : (quote!.source ?? "highlight") === "note"
        ? `my note · page ${quote!.page}`
        : `page ${quote!.page}`,
    quoteSize: quoteFontSize(text.length),
    stats: cards,
    variant: text ? "quote" : "title",
    // A credit line when a quote is the hero; the hero itself when it isn't.
    titleSize: text ? 62 : titleFontSize(title.length),
    eyebrow: text ? "NOW READING" : percent < 5 ? "JUST STARTED" : "NOW READING",
  };
}

/** Hero-title sizing — long titles have to come down or they wrap to four lines. */
export function titleFontSize(length: number): number {
  if (length <= 22) return 104;
  if (length <= 40) return 84;
  if (length <= 70) return 66;
  return 52;
}
