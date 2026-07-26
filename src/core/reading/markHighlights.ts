/**
 * Painting saved highlights back onto the page.
 *
 * A highlight you can't see isn't really a highlight — before this it only
 * existed as a row in the Saved list, and the page you marked looked exactly
 * like a page you hadn't.
 *
 * The hard part is that a PDF's text layer is not a document. It's a bag of
 * positioned fragments, and one highlighted sentence is usually spread across
 * several of them, split at arbitrary points with whitespace that doesn't
 * match what was selected. So matching is done on a normalized copy of the
 * text — lowercased, whitespace collapsed — with an index map back to the
 * original, and both directions are handled: a fragment sitting *inside* a
 * long highlight, and a short highlight sitting *inside* a long fragment.
 *
 * The output is HTML, because that's the contract `react-pdf`'s
 * `customTextRenderer` imposes — it assigns the return value as innerHTML.
 * Everything here is therefore escaped. The text comes from an uploaded file,
 * which is not a trustworthy source.
 */

/** A fragment shorter than this matches too much to be meaningful. */
const MIN_FRAGMENT_CHARS = 3;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Lowercased, whitespace-collapsed text plus a map back to original offsets. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      pendingSpace = chars.length > 0;
      continue;
    }
    if (pendingSpace) {
      chars.push(" ");
      map.push(i);
      pendingSpace = false;
    }
    chars.push(ch.toLowerCase());
    map.push(i);
  }
  return { norm: chars.join(""), map };
}

export interface Range {
  start: number;
  end: number;
}

/** Merges overlapping ranges so nested `<mark>` elements can't be produced. */
export function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [sorted[0]!];
  for (const r of sorted.slice(1)) {
    const last = out[out.length - 1]!;
    if (r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** Which parts of `text` belong to any of `highlights`. */
export function findRanges(text: string, highlights: string[]): Range[] {
  if (!text.trim() || highlights.length === 0) return [];
  const { norm, map } = normalizeWithMap(text);
  if (!norm) return [];

  const ranges: Range[] = [];
  for (const raw of highlights) {
    const { norm: needle } = normalizeWithMap(raw);
    if (!needle) continue;

    // The fragment is part of a longer highlight — mark all of it.
    if (norm.length >= MIN_FRAGMENT_CHARS && needle.includes(norm)) {
      ranges.push({ start: 0, end: text.length });
      continue;
    }

    // The highlight sits inside this fragment — mark just that span. A
    // highlight can legitimately appear more than once on a page.
    let from = 0;
    for (;;) {
      const at = norm.indexOf(needle, from);
      if (at === -1 || needle.length < MIN_FRAGMENT_CHARS) break;
      ranges.push({ start: map[at]!, end: map[at + needle.length - 1]! + 1 });
      from = at + needle.length;
    }
  }
  return mergeRanges(ranges);
}

/** Subtracts `taken` from `range`, returning whatever is left of it. */
function without(range: Range, taken: Range[]): Range[] {
  let pieces: Range[] = [range];
  for (const t of taken) {
    const next: Range[] = [];
    for (const p of pieces) {
      if (t.end <= p.start || t.start >= p.end) {
        next.push(p);
        continue;
      }
      if (t.start > p.start) next.push({ start: p.start, end: t.start });
      if (t.end < p.end) next.push({ start: t.end, end: p.end });
    }
    pieces = next;
  }
  return pieces;
}

/**
 * `text` as HTML, with highlighted parts wrapped in `<mark>`.
 *
 * Two species, because in a reading room your mark and someone else's have to
 * be tellable apart on the same page. Where they cover the same words yours
 * wins outright rather than blending — overlapping translucent marks make a
 * third colour that means nothing.
 *
 * Returns escaped text unchanged when nothing matches.
 */
export function markHighlights(text: string, mine: string[], theirs: string[] = []): string {
  const own = findRanges(text, mine);
  const peer = mergeRanges(findRanges(text, theirs).flatMap((r) => without(r, own)));

  const all = [
    ...own.map((r) => ({ ...r, cls: "hl-mine" })),
    ...peer.map((r) => ({ ...r, cls: "hl-peer" })),
  ].sort((a, b) => a.start - b.start);

  if (all.length === 0) return escapeHtml(text);

  let out = "";
  let cursor = 0;
  for (const r of all) {
    out += escapeHtml(text.slice(cursor, r.start));
    out += `<mark class="${r.cls}">${escapeHtml(text.slice(r.start, r.end))}</mark>`;
    cursor = r.end;
  }
  return out + escapeHtml(text.slice(cursor));
}
