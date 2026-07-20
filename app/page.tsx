"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface BookSummary {
  id: string;
  title: string;
  page_count: number;
  status: string;
}

const STATUS_BADGES: Record<string, { className: string; label: string; spinning?: boolean }> = {
  uploaded: { className: "badge-info", label: "Uploaded" },
  processing: { className: "badge-warn", label: "Processing", spinning: true },
  ready: { className: "badge-ok", label: "Ready" },
  failed: { className: "badge-danger", label: "Failed" },
};

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export default function Home() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refresh() {
    const res = await fetch("/api/books");
    if (res.ok) setBooks(await res.json());
    setLoaded(true);
  }

  useEffect(() => {
    void refresh();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  useEffect(() => {
    const hasProcessing = books.some((b) => b.status === "processing" || b.status === "uploaded");
    if (!hasProcessing) return;
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [books]);

  function armDelete(bookId: string) {
    setConfirmDelete(bookId);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmDelete(null), 3000);
  }

  async function onDelete(bookId: string) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmDelete(null);
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

  async function uploadFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`);
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
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragover(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.25rem" }}>
      <h1 className="wordmark" style={{ marginBottom: "0.25rem", fontSize: "2rem" }}>
        PDF Companion
      </h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        An AI that reads with you — always on your page, holding the whole book in mind.
      </p>

      <label
        className={`dropzone${dragover ? " is-dragover" : ""}${busy ? " is-busy" : ""}`}
        style={{ marginTop: "1.25rem" }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
      >
        {busy ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="spinner" /> Uploading…
          </span>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>Drop a PDF here, or click to browse</span>
            <span style={{ color: "var(--faint)", fontSize: "0.8rem" }}>Up to 50 MB</span>
          </>
        )}
        <input
          type="file"
          accept="application/pdf"
          onChange={onUpload}
          disabled={busy}
          style={{ display: "none" }}
        />
      </label>

      {error && (
        <p role="alert" className="fade-in" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem" }}>
        {!loaded &&
          [0, 1, 2].map((i) => (
            <li key={i} className="skeleton" style={{ height: 58, marginBottom: "0.6rem" }} />
          ))}

        {books.map((b) => {
          const badge = STATUS_BADGES[b.status] ?? STATUS_BADGES.uploaded!;
          return (
            <li
              key={b.id}
              className="card card-interactive fade-in"
              style={{
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
                  <Link href={`/reader/${b.id}`} style={{ fontWeight: 500 }}>
                    {b.title}
                  </Link>
                ) : (
                  <span style={{ color: b.status === "failed" ? "var(--danger)" : "var(--text)" }}>
                    {b.title}
                  </span>
                )}
                <span style={{ color: "var(--muted)" }}> · {b.page_count} pages</span>
                <span className={`badge ${badge.className}`} style={{ marginLeft: "0.5rem" }}>
                  {badge.spinning && <span className="spinner" style={{ width: 9, height: 9 }} />}
                  {badge.label}
                </span>
              </span>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                {b.status === "failed" && (
                  <button
                    className="btn-warn btn-sm"
                    onClick={() => onRetry(b.id)}
                    disabled={retrying === b.id}
                  >
                    {retrying === b.id ? "Retrying…" : "Retry"}
                  </button>
                )}
                {confirmDelete === b.id ? (
                  <button
                    className="btn-danger-solid btn-sm"
                    onClick={() => onDelete(b.id)}
                    disabled={deleting === b.id}
                  >
                    Confirm delete?
                  </button>
                ) : (
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => armDelete(b.id)}
                    disabled={deleting === b.id}
                  >
                    {deleting === b.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </li>
          );
        })}

        {loaded && books.length === 0 && (
          <li
            className="card fade-in"
            style={{
              padding: "2rem 1rem",
              textAlign: "center",
              color: "var(--muted)",
              borderStyle: "dashed",
            }}
          >
            <p style={{ margin: 0, fontSize: "1.5rem" }}>📖</p>
            <p style={{ margin: "0.5rem 0 0" }}>No books yet — upload one to start reading.</p>
          </li>
        )}
      </ul>
    </main>
  );
}
