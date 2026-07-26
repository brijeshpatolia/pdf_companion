/**
 * Font bytes for the share card.
 *
 * Satori doesn't inherit system fonts — `fontFamily: "serif"` silently falls
 * back to its bundled sans unless you hand it the actual bytes. The card is a
 * quote from a book, so a serif is the whole point; without this the card
 * renders in the same UI sans as everything else and reads like a dashboard.
 *
 * Fetched once per server instance and memoized. Every failure path returns
 * an empty list, which renders the card in Satori's default font — a worse
 * card, but still a card. A share image is never worth a 500.
 */

let cached: Promise<FontSpec[]> | null = null;

export interface FontSpec {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal" | "italic";
}

const FACES: { query: string; weight: 400 | 600; style: "normal" | "italic" }[] = [
  { query: "Lora:ital,wght@0,600", weight: 600, style: "normal" },
  { query: "Lora:ital,wght@1,400", weight: 400, style: "italic" },
];

async function fetchFace(query: string): Promise<ArrayBuffer | null> {
  try {
    // The CSS endpoint returns a different format per User-Agent; this one
    // yields a plain TTF, which is what Satori wants.
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
    }).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Serif faces for the card, or [] if they can't be fetched. */
export function cardFonts(): Promise<FontSpec[]> {
  cached ??= (async () => {
    const loaded = await Promise.all(
      FACES.map(async (f) => {
        const data = await fetchFace(f.query);
        return data ? { name: "Lora", data, weight: f.weight, style: f.style } : null;
      }),
    );
    return loaded.filter((f): f is FontSpec => f !== null);
  })().catch(() => []);
  return cached;
}
