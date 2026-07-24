import type { NewCard } from "./types.js";

const MAX_FRONT = 500;
const MAX_BACK = 2000;
const DEFAULT_COUNT = 12;
const HARD_MAX = 30;

export interface KeptContent {
  bookTitle: string;
  highlights: string[];
  answers: { question?: string; text: string }[];
  notes: string[];
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** True when there's nothing to build flashcards from. */
export function hasKeptContent(k: KeptContent): boolean {
  return k.highlights.length > 0 || k.answers.length > 0 || k.notes.length > 0;
}

/** Builds the chat messages that ask the model for flashcards as JSON. */
export function buildFlashcardMessages(kept: KeptContent, count = DEFAULT_COUNT): ChatMessage[] {
  const n = Math.min(Math.max(1, count), HARD_MAX);

  const parts: string[] = [];
  if (kept.highlights.length) {
    parts.push("Highlights:\n" + kept.highlights.map((h) => `- ${h}`).join("\n"));
  }
  if (kept.answers.length) {
    parts.push(
      "Saved Q&A:\n" +
        kept.answers
          .map((a) => (a.question ? `- Q: ${a.question}\n  A: ${a.text}` : `- ${a.text}`))
          .join("\n"),
    );
  }
  if (kept.notes.length) {
    parts.push("Notes:\n" + kept.notes.map((nt) => `- ${nt}`).join("\n"));
  }

  const system =
    "You create study flashcards from what a reader has kept while reading a book. " +
    `Write up to ${n} concise question/answer flashcards that test genuine understanding of the ideas — ` +
    "not trivia about wording. Each card's front is a question; the back is a short, self-contained answer. " +
    "Only use the material provided. " +
    'Respond with ONLY a JSON array like [{"front":"…","back":"…"}] — no prose, no code fences.';

  const user = `Book: ${kept.bookTitle}\n\n${parts.join("\n\n")}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Trim + length-cap a single card, or return null if it isn't usable. */
export function normalizeCard(raw: unknown): NewCard | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const front = pick(obj, ["front", "question", "q"]);
  const back = pick(obj, ["back", "answer", "a"]);
  if (!front || !back) return null;
  return {
    front: front.length > MAX_FRONT ? front.slice(0, MAX_FRONT) + "…" : front,
    back: back.length > MAX_BACK ? back.slice(0, MAX_BACK) + "…" : back,
  };
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Parse a model response into flashcards. Tolerates code fences and prose
 * around the JSON array, alternate key names (question/answer), duplicates,
 * and truncation. Returns [] rather than throwing on unparseable input.
 */
export function parseFlashcards(text: string, max = HARD_MAX): NewCard[] {
  const json = extractJsonArray(text);
  if (!json) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: NewCard[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const card = normalizeCard(item);
    if (!card) continue;
    const key = card.front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
    if (out.length >= max) break;
  }
  return out;
}

/** Pull the outermost [ … ] out of a possibly-fenced, prose-wrapped string. */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
