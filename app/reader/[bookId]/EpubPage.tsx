"use client";

import { markHighlights } from "@/core/reading/markHighlights.js";
import { createPageCache } from "@/core/reading/pageCache.js";

import { useEffect, useState } from "react";

interface EpubPageProps {
  bookId: string;
  page: number;
  /** Saved highlight text for this page, painted onto the prose. */
  highlights?: string[];
  /** Marks made by others in the reading room, shown in their own colour. */
  peerHighlights?: string[];
}

/**
 * Text the reader has already been sent, kept for the length of the visit.
 *
 * Shared by every instance rather than held in one, because the reader mounts
 * a fresh EpubPage per page — which is what lets a page already fetched render
 * with its words in place instead of appearing a frame later.
 */
const held = createPageCache<string>(24);
/** Requests already out, so a prefetch and a page turn don't both ask. */
const pending = new Map<string, Promise<string | null>>();

function fetchPage(bookId: string, page: number): Promise<string | null> {
  const key = `${bookId}:${page}`;
  const cached = held.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const running = pending.get(key);
  if (running) return running;

  const request = fetch(`/api/page-text?bookId=${bookId}&page=${page}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data: { text?: unknown }) => {
      const text = typeof data.text === "string" ? data.text : "";
      held.set(key, text);
      return text;
    })
    .catch(() => null)
    // Failures are deliberately not cached: a page past the end of the book is
    // asked for once per turn near the end, and a page that failed on a flaky
    // connection is worth asking for again.
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

/**
 * Renders one synthetic EPUB page as text, fetched from /api/page-text.
 * The selection tooltip works over this text just like the PDF text layer.
 */
export default function EpubPage({ bookId, page, highlights = [], peerHighlights = [] }: EpubPageProps) {
  const [text, setText] = useState<string | null>(() => held.get(`${bookId}:${page}`) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (text !== null) return;
    let cancelled = false;
    fetchPage(bookId, page).then((t) => {
      if (cancelled) return;
      if (t === null) setError(true);
      else setText(t);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, page, text]);

  // The page ahead and the one behind, once this one is up. A book is read in
  // order and then thought better of, so those are the two guesses worth
  // making — and making them is what turns a page turn into a page turn rather
  // than a wait.
  useEffect(() => {
    if (text === null) return;
    const timer = setTimeout(() => {
      void fetchPage(bookId, page + 1);
      if (page > 1) void fetchPage(bookId, page - 1);
    }, 200);
    return () => clearTimeout(timer);
  }, [bookId, page, text]);

  if (error) {
    return <p style={{ color: "var(--danger)" }}>Could not load this page.</p>;
  }

  if (text === null) {
    return (
      <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--muted)" }}>
        <span className="spinner" /> Loading page…
      </p>
    );
  }

  return (
    <article className="epub-page fade-in">
      {text.split(/\n{2,}/).map((para, i) => (
        // Marked HTML rather than a text node: the marker escapes everything
        // it emits, and the book's own text is never trusted as markup.
        <p key={i} dangerouslySetInnerHTML={{ __html: markHighlights(para, highlights, peerHighlights) }} />
      ))}
    </article>
  );
}
