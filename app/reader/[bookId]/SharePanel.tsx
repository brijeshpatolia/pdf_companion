"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Compact share control for the Companion's Saved tab: create a read-only
 * public link for this book, copy it, or stop sharing.
 */
export default function SharePanel({ bookId }: { bookId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let alive = true;
    fetch(`/api/share?bookId=${bookId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (alive) setToken(d.token ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [bookId]);

  const shareUrl = token ? `${origin}/share/${token}` : "";

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.token) setToken(d.token);
    } catch {
      /* surfaced by the button staying in its prior state */
    } finally {
      setBusy(false);
    }
  }, [bookId]);

  const stop = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/share?bookId=${bookId}`, { method: "DELETE" });
      if (r.ok) {
        setToken(null);
        setCopied(false);
      }
    } catch {
      /* no-op */
    } finally {
      setBusy(false);
    }
  }, [bookId]);

  const copy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the input is selectable as a fallback */
    }
  }, [shareUrl]);

  if (!loaded) return null;

  return (
    <div className="share-panel">
      {token ? (
        <>
          <p className="share-panel-hint">
            🔗 Anyone with this link can view your highlights, saved answers, notes, and flashcards for this book —
            read-only.
          </p>
          <div className="share-panel-row">
            <input
              className="input"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Public share link"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn-primary btn-sm" onClick={copy} type="button">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button className="btn-ghost btn-sm" onClick={stop} disabled={busy} type="button">
            {busy ? "…" : "Stop sharing"}
          </button>
        </>
      ) : (
        <button className="btn-ghost btn-sm" onClick={start} disabled={busy} type="button" title="Create a read-only public link">
          {busy ? "Creating…" : "🔗 Share book"}
        </button>
      )}
    </div>
  );
}
