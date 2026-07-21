/**
 * Convert a chapter's XHTML into readable plain text: drop scripts/styles,
 * turn block-level boundaries into blank lines, strip remaining tags, and
 * decode entities. Deliberately simple — good enough to feed embeddings and
 * a text reader, not a faithful renderer.
 */

// Non-breaking space and the assorted unicode spaces EPUBs use.
const UNICODE_SPACES = new RegExp("[\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]", "g");

export function htmlToText(html: string): string {
  let s = html;

  // Remove content we never want as text.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|head|svg)[\s\S]*?<\/\1>/gi, "");

  // Paragraph/section breaks → blank line.
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|blockquote|tr|figure|figcaption)\s*>/gi, "\n\n");
  // Line breaks.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // List items get a bullet for readability.
  s = s.replace(/<li[^>]*>/gi, "• ");

  // Drop every remaining tag.
  s = s.replace(/<[^>]+>/g, "");

  s = decodeEntities(s);
  s = s.replace(UNICODE_SPACES, " ");

  // Collapse runs of horizontal whitespace, trim each line, and cap
  // consecutive blank lines at one.
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? safeFromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}
