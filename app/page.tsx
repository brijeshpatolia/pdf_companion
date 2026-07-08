"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BookSummary {
  id: string;
  title: string;
  page_count: number;
  status: string;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  uploaded: { color: "#93c5fd", bg: "#1e3a5f", label: "Uploaded" },
  processing: { color: "#fbbf24", bg: "#422006", label: "Processing…" },
  ready: { color: "#4ade80", bg: "#052e16", label: "Ready" },
  failed: { color: "#fca5a5", bg: "#450a0a", label: "Failed" },
};

export default function Home() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/books");
    if (res.ok) setBooks(await res.json());
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const hasProcessing = books.some((b) => b.status === "processing" || b.status === "uploaded");
    if (!hasProcessing) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [books]);

  async function onDelete(bookId: string) {
    setDeleting(bookId);
    setError(null);
    try {
      const res = await fetch(`/api/books?bookId=${bookId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `delete failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  async function onRetry(bookId: string) {
    setRetrying(bookId);
    setError(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      if (!res.ok) {
        throw new Error(`retry failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRetrying(null);
    }
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`);
      e.target.value = "";
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/books", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `upload failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>PDF Companion</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>An AI that reads with you.</p>

      <label
        style={{
          display: "inline-block",
          marginTop: "1rem",
          padding: "0.5rem 0.9rem",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--panel)",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Uploading…" : "Upload a PDF"}
        <input
          type="file"
          accept="application/pdf"
          onChange={onUpload}
          disabled={busy}
          style={{ display: "none" }}
        />
      </label>

      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem" }}>
        {books.map((b) => {
          const s = STATUS_STYLES[b.status] ?? STATUS_STYLES.uploaded!;
          return (
            <li
              key={b.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "0.8rem 1rem",
                marginBottom: "0.6rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {b.status === "ready" ? (
                  <Link href={`/reader/${b.id}`}>{b.title}</Link>
                ) : (
                  <span style={{ color: b.status === "failed" ? "#fca5a5" : "var(--text)" }}>{b.title}</span>
                )}
                <span style={{ color: "var(--muted)" }}> · {b.page_count} pages</span>
                <span
                  style={{
                    display: "inline-block",
                    marginLeft: "0.5rem",
                    padding: "0.1rem 0.5rem",
                    borderRadius: 12,
                    fontSize: "0.75rem",
                    color: s.color,
                    background: s.bg,
                  }}
                >
                  {s.label}
                </span>
              </span>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                {b.status === "failed" && (
                  <button
                    onClick={() => onRetry(b.id)}
                    disabled={retrying === b.id}
                    style={{
                      background: "none",
                      border: "1px solid #854d0e",
                      borderRadius: 6,
                      color: "#fbbf24",
                      padding: "0.25rem 0.6rem",
                      cursor: retrying === b.id ? "not-allowed" : "pointer",
                      opacity: retrying === b.id ? 0.5 : 1,
                      fontSize: "0.8rem",
                    }}
                  >
                    {retrying === b.id ? "Retrying…" : "Retry"}
                  </button>
                )}
                <button
                  onClick={() => onDelete(b.id)}
                  disabled={deleting === b.id}
                  style={{
                    background: "none",
                    border: "1px solid #7f1d1d",
                    borderRadius: 6,
                    color: "#fca5a5",
                    padding: "0.25rem 0.6rem",
                    cursor: deleting === b.id ? "not-allowed" : "pointer",
                    opacity: deleting === b.id ? 0.5 : 1,
                    fontSize: "0.8rem",
                  }}
                >
                  {deleting === b.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          );
        })}
        {books.length === 0 && (
          <li style={{ color: "var(--muted)" }}>No books yet — upload one to start reading.</li>
        )}
      </ul>
    </main>
  );
}
