"use client";

import { markHighlights } from "@/core/reading/markHighlights.js";

import { useEffect, useState } from "react";

interface EpubPageProps {
  bookId: string;
  page: number;
  /** Saved highlight text for this page, painted onto the prose. */
  highlights?: string[];
}

/**
 * Renders one synthetic EPUB page as text, fetched from /api/page-text.
 * The selection tooltip works over this text just like the PDF text layer.
 */
export default function EpubPage({ bookId, page, highlights = [] }: EpubPageProps) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(false);
    fetch(`/api/page-text?bookId=${bookId}&page=${page}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setText(typeof data.text === "string" ? data.text : "");
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, page]);

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
        <p key={i} dangerouslySetInnerHTML={{ __html: markHighlights(para, highlights) }} />
      ))}
    </article>
  );
}
