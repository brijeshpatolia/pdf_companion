import type { LiveHighlight, Participant } from "./types.js";

/**
 * Everything crossing the room channel comes from *another participant's
 * browser* — anyone holding the link. It is untrusted input in exactly the way
 * a request body is, so it gets validated and clamped here before any of it
 * reaches React. Nothing is rendered as HTML, but an unbounded string or a
 * nonsense page number would still wreck the UI for everyone in the room.
 */

/** Long enough for a paragraph-length quote, short enough to not be a payload. */
export const MAX_HIGHLIGHT_CHARS = 1000;
export const MAX_NAME_CHARS = 60;

export interface PresenceMeta {
  userId: string;
  name: string;
  page: number;
}

const cleanString = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** A page number a reader could actually be on, or null. */
function cleanPage(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const page = Math.floor(n);
  return page >= 1 ? page : null;
}

/** Validates one presence entry; null if it isn't usable. */
export function parsePresenceMeta(raw: unknown): PresenceMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const userId = cleanString(r.userId, 64);
  const page = cleanPage(r.page);
  if (!userId || page === null) return null;
  return { userId, name: cleanString(r.name, MAX_NAME_CHARS) || "Reader", page };
}

/**
 * Flattens Supabase's presence state — `{ [key]: meta[] }` — into a
 * participant list. Entries that fail validation are dropped rather than
 * rendered, and the list is ordered so it doesn't reshuffle on every heartbeat.
 */
export function participantsFrom(
  state: Record<string, unknown[]>,
  selfKey: string,
): Participant[] {
  const participants: Participant[] = [];
  for (const [key, metas] of Object.entries(state)) {
    const meta = parsePresenceMeta(metas?.[0]);
    if (!meta) continue;
    participants.push({ key, ...meta, isSelf: key === selfKey });
  }
  // Self first, then stable by key — presence heartbeats must not make the
  // list jump around while someone is reading it.
  return participants.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
}

/** Validates a broadcast highlight; null if it isn't usable. */
export function parseLiveHighlight(raw: unknown, at: number): LiveHighlight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = cleanString(r.text, MAX_HIGHLIGHT_CHARS);
  const page = cleanPage(r.page);
  const userId = cleanString(r.userId, 64);
  if (!text || page === null || !userId) return null;
  return {
    id: cleanString(r.id, 64) || `${userId}-${at}`,
    userId,
    name: cleanString(r.name, MAX_NAME_CHARS) || "Reader",
    page,
    text,
    at,
  };
}

/** Keeps the live feed to the most recent few, newest first. */
export function addHighlight(
  feed: LiveHighlight[],
  incoming: LiveHighlight,
  max = 20,
): LiveHighlight[] {
  if (feed.some((h) => h.id === incoming.id)) return feed;
  return [incoming, ...feed].slice(0, max);
}
