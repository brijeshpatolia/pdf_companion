/**
 * Pages of a book already fetched.
 *
 * An EPUB page is its own request, so turning back a page asked the server for
 * text it had just sent, and the reader watched a spinner for something they
 * had been looking at a second earlier. A page turn that has to wait isn't a
 * page turn, so the text is kept.
 *
 * Bounded, because a book read end to end would otherwise hold every page it
 * passed for as long as the tab is open. Least recently *used* goes first
 * rather than least recently added: reading back and forth over a passage
 * should keep that passage, not whichever two pages happen to be newest.
 */
export interface PageCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
  readonly size: number;
}

export function createPageCache<T>(limit: number): PageCache<T> {
  // A Map iterates in insertion order, so deleting a key before setting it
  // moves it to the end — which makes the first key out always the oldest.
  const entries = new Map<string, T>();
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;

  return {
    get(key) {
      if (!entries.has(key)) return undefined;
      const value = entries.get(key)!;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      if (cap === 0) return;
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > cap) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    has: (key) => entries.has(key),
    get size() {
      return entries.size;
    },
  };
}
