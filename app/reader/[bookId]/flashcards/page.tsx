"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export default function FlashcardsPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/flashcards?bookId=${bookId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCards(data);
          setIndex((i) => Math.min(i, Math.max(0, data.length - 1)));
        }
      }
    } catch {} finally {
      setLoaded(true);
    }
  }, [bookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((i) => {
        if (cards.length === 0) return 0;
        return (i + delta + cards.length) % cards.length;
      });
    },
    [cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function generate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `generation failed (${res.status})`);
      setMessage({ text: `Generated ${data.count} card${data.count === 1 ? "" : "s"}.`, kind: "ok" });
      await refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function add() {
    if (!front.trim() || !back.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, front, back }),
      });
      if (res.ok) {
        setFront("");
        setBack("");
        await refresh();
      }
    } catch {} finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/flashcards?id=${id}`, { method: "DELETE" });
      await refresh();
    } catch {}
  }

  const current = cards[index];

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <h1 className="wordmark" style={{ fontSize: "1.6rem", margin: 0 }}>
          🃏 Flashcards
        </h1>
        <Link href={`/reader/${bookId}`} className="btn-ghost btn-sm" style={{ whiteSpace: "nowrap" }}>
          ← Back to book
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <button className="btn-primary btn-sm" onClick={generate} disabled={generating}>
          {generating ? "Generating…" : "✨ Generate from what you kept"}
        </button>
      </div>

      {message && (
        <p role="status" className="fade-in" style={{ color: message.kind === "ok" ? "var(--ok)" : "var(--danger)", fontSize: "0.85rem", marginTop: "0.6rem" }}>
          {message.text}
        </p>
      )}

      {/* review */}
      {loaded && cards.length === 0 && (
        <div className="card" style={{ marginTop: "1.5rem", padding: "2rem 1rem", textAlign: "center", color: "var(--muted)", borderStyle: "dashed" }}>
          <p style={{ margin: 0, fontSize: "1.4rem" }}>🃏</p>
          <p style={{ margin: "0.5rem 0 0" }}>No flashcards yet. Generate a set from your highlights, answers, and notes — or add one below.</p>
        </div>
      )}

      {current && (
        <div style={{ marginTop: "1.5rem" }}>
          <div
            className={`flashcard${flipped ? " is-flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            aria-label="Flip flashcard"
            title="Click or press space to flip"
          >
            <div className="flashcard-inner">
              <div className="flashcard-face flashcard-front">
                <span className="face-label">Question</span>
                {current.front}
              </div>
              <div className="flashcard-face flashcard-back">
                <span className="face-label">Answer</span>
                {current.back}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginTop: "1rem" }}>
            <button className="btn-sm" onClick={() => go(-1)} aria-label="Previous card">‹ Prev</button>
            <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "center" }}>
              {index + 1} / {cards.length}
            </span>
            <button className="btn-sm" onClick={() => go(1)} aria-label="Next card">Next ›</button>
          </div>

          <div style={{ textAlign: "center", marginTop: "0.6rem" }}>
            <button className="save-btn" onClick={() => remove(current.id)} title="Delete this card">
              ✕ Delete this card
            </button>
          </div>
        </div>
      )}

      {/* manual add */}
      <details style={{ marginTop: "2rem" }}>
        <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.9rem" }}>Add a card manually</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
          <textarea className="input" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front (question)" rows={2} style={{ resize: "vertical" }} />
          <textarea className="input" value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back (answer)" rows={2} style={{ resize: "vertical" }} />
          <div style={{ textAlign: "right" }}>
            <button className="btn-primary btn-sm" onClick={add} disabled={adding || !front.trim() || !back.trim()}>
              {adding ? "Adding…" : "Add card"}
            </button>
          </div>
        </div>
      </details>
    </main>
  );
}
