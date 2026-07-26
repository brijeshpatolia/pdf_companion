"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "../../components/Icon";

/**
 * The share card, previewed and handed off.
 *
 * On a phone this uses the Web Share API, which is the only path that reaches
 * Instagram directly — the app has no public upload API, so "share to
 * Instagram" in practice means handing the OS a file and letting the share
 * sheet do the rest. Desktop browsers mostly can't share files, so there the
 * button downloads instead. Both paths are offered rather than detected up
 * front, because `canShare` lies often enough that trying and falling back is
 * more reliable than asking.
 */

interface Props {
  bookId: string;
  title: string;
  /** Prefer the highlight on this page, when the reader has one there. */
  page?: number;
  onClose: () => void;
}

export default function ShareCardPanel({ bookId, title, page, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/share-card/${bookId}${page ? `?page=${page}` : ""}`);
        if (!res.ok) throw new Error(`couldn't build the card (${res.status})`);
        const b = await res.blob();
        if (cancelled) return;
        revoked = URL.createObjectURL(b);
        setBlob(b);
        setUrl(revoked);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [bookId, page]);

  // Escape closes, like every other dismissible layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}-reading.png`;

  const download = useCallback(() => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }, [url, fileName]);

  const share = useCallback(async () => {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const file = new File([blob], fileName, { type: "image/png" });
      // Try first, ask never: canShare is unreliable across browsers.
      await navigator.share({ files: [file], title });
    } catch (e) {
      // A user hitting cancel is not an error worth showing.
      if ((e as Error).name !== "AbortError") download();
    } finally {
      setBusy(false);
    }
  }, [blob, fileName, title, download]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your reading"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 6, 12, 0.72)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        zIndex: 50,
      }}
    >
      <div
        className="card rise-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "1.1rem",
          maxWidth: 420,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.95rem" }}>Share your reading</strong>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        {error ? (
          <p role="alert" style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>
            {error}
          </p>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Your reading card"
            style={{
              width: "100%",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "1080 / 1350",
              borderRadius: "var(--radius)",
              background: "var(--bg-raised)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontSize: "0.85rem",
            }}
          >
            <span className="spinner" /> Building your card…
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-primary" onClick={share} disabled={!blob || busy} style={{ flex: 1 }}>
            <Icon name="share" /> {busy ? "Sharing…" : "Share"}
          </button>
          <button className="btn-ghost" onClick={download} disabled={!url}>
            <Icon name="download" /> Save
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--faint)" }}>
          Sized for Instagram. On a phone, Share opens your apps directly.
        </p>
      </div>
    </div>
  );
}
