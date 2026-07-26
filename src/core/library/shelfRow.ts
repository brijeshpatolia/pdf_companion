/**
 * What one row on the library shelf says.
 *
 * The database stores four statuses — uploaded, processing, ready, failed —
 * but a shelf needs a fifth distinction the database doesn't make: a book you
 * have started is not the same as a book merely sitting there ready. So
 * "reading" is derived here rather than stored, and it is the state most rows
 * will be in.
 *
 * Each state has to be legible at a glance and visibly different from the
 * others, because the whole job of this screen is telling you which book to
 * open next.
 */

export type ShelfState = "reading" | "ready" | "processing" | "failed";

export interface ShelfBook {
  id: string;
  title: string;
  page_count: number;
  status: string;
  /** Pages embedded so far, while a book is still being ingested. */
  pages_done?: number | null;
  /** Where the reader left off, if they have started. */
  current_page?: number | null;
}

export interface ShelfRow {
  state: ShelfState;
  /** Badge wording — short enough to sit in a pill. */
  label: string;
  /** The line under the title: what this book is, or what's happening to it. */
  meta: string;
  /** 0–100. Reading fraction, or ingestion fraction while processing. */
  percent: number;
  /** Right-aligned readout: a page, a percentage, or a call to action. */
  right: string;
  /** True when the title should link into the reader. */
  openable: boolean;
}

/** A book is "in flight" while it is queued for or partway through ingestion. */
export const inFlight = (status: string) => status === "processing" || status === "uploaded";

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

export function shelfRow(b: ShelfBook): ShelfRow {
  const pages = Math.max(0, Math.floor(b.page_count || 0));

  if (b.status === "failed") {
    return {
      state: "failed",
      label: "Failed",
      meta: "upload interrupted",
      percent: 100,
      // The Retry control sits beside this row and already says "Retry" —
      // repeating it here reads as two different offers.
      right: "",
      openable: false,
    };
  }

  if (inFlight(b.status)) {
    const done = Math.max(0, b.pages_done ?? 0);
    return {
      state: "processing",
      label: "Processing",
      // Concrete counts, because "processing" alone gives no sense of whether
      // this is worth waiting for.
      meta: pages > 0 ? `embedding ${done} of ${pages}` : "embedding…",
      percent: pct(done, pages),
      right: pages > 0 ? `${pct(done, pages)}%` : "—",
      openable: true, // reading is allowed while the rest embeds
    };
  }

  const page = b.current_page ?? 0;
  if (page > 1) {
    return {
      state: "reading",
      label: "Reading",
      meta: `${pages} pages`,
      percent: pct(page, pages),
      right: `p. ${page}`,
      openable: true,
    };
  }

  return {
    state: "ready",
    label: "Ready",
    meta: `${pages} pages`,
    // A full inert bar: finished ingesting, not finished reading. The colour
    // carries that difference, not the width.
    percent: 100,
    right: "Start",
    openable: true,
  };
}

/**
 * A stable colour per book, so a given book keeps its spine across sessions
 * without us storing one. Taken from the design's fixed set rather than a
 * continuous hue, so no two spines land on almost-the-same brown.
 */
export const SPINE_COLOURS = [
  "#7c5a3a",
  "#3f5b45",
  "#3e4e63",
  "#5c3a3a",
  "#8a6a4a",
  "#2f3440",
  "#e8dcc4",
  "#1f1e1c",
] as const;

export function spineColour(id: string): string {
  // FNV-1a. A plain `h * 31 + c` hash keeps its low bits too close together
  // for short, similar ids — four books added in a row all came out the same
  // brown, which defeats the point of a spine colour.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return SPINE_COLOURS[h % SPINE_COLOURS.length]!;
}

/** Bone spines need dark lettering; the rest are dark enough for cream. */
export function spineInk(colour: string): string {
  return colour === "#e8dcc4" ? "#211e19" : "#efeae2";
}

/** The subtitle under "Your library" — what this shelf currently amounts to. */
export function shelfSummary(books: ShelfBook[], lastOpened?: string | null): string {
  if (books.length === 0) return "Nothing here yet.";
  const count = `${books.length} book${books.length === 1 ? "" : "s"}`;
  const pagesRead = books.reduce((n, b) => n + Math.max(0, (b.current_page ?? 1) - 1), 0);
  const parts = [count];
  if (pagesRead > 0) parts.push(`${pagesRead.toLocaleString()} pages read`);
  if (lastOpened) parts.push(`last opened ${lastOpened}`);
  return parts.join(" · ");
}
