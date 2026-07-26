"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthButton from "./AuthButton";
import Icon from "./components/Icon";
import AppRail from "./components/AppRail";
import {
  shelfRow,
  spineColour,
  spineInk,
  shelfSummary,
  inFlight,
  type ShelfBook,
} from "@/core/library/shelfRow.js";

type BookSummary = ShelfBook;

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
    if (!books.some((b) => inFlight(b.status))) return;
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
    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isEpub = file.type === "application/epub+zip" || name.endsWith(".epub");
    if (!isPdf && !isEpub) {
      setError("Only PDF and EPUB files are supported.");
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

  const lastOpened =
    books.filter((b) => (b.current_page ?? 0) > 1).sort((a, b) => (b.current_page ?? 0) - (a.current_page ?? 0))[0]
      ?.title ?? null;

  return (
    <div className="rail-layout">
      <AppRail />
      <main className="shelf">
        <header className="shelf-head">
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 34, margin: 0 }}>Your library</h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-600)" }}>
              {loaded ? shelfSummary(books, lastOpened) : "\u00a0"}
            </p>
          </div>
          <div className="shelf-head-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <Link href="/ask" className="btn-ghost btn-sm">
              Ask across library
            </Link>
            <label className="btn-primary btn-sm" style={{ cursor: busy ? "default" : "pointer" }}>
              {busy ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="application/pdf,application/epub+zip,.pdf,.epub"
                onChange={onUpload}
                disabled={busy}
                style={{ display: "none" }}
              />
            </label>
            <AuthButton />
          </div>
        </header>

        <label
          className={`shelf-drop${dragover ? " is-dragover" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={onDrop}
        >
          <span className="shelf-drop-tile" aria-hidden="true">
            <Icon name="download" size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>
              {busy ? "Uploading…" : "Drop a PDF or EPUB here"}
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text-700)", marginTop: 3 }}>
              Up to 50&nbsp;MB · text is embedded page by page, and you can start reading immediately
            </span>
          </span>
          <span className="btn-ghost btn-sm" style={{ flexShrink: 0 }}>
            Browse files
          </span>
          <input
            type="file"
            accept="application/pdf,application/epub+zip,.pdf,.epub"
            onChange={onUpload}
            disabled={busy}
            style={{ display: "none" }}
          />
        </label>

        {error && (
          <p role="alert" className="fade-in" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        <div className="shelf-section">
          <span className="eyebrow">Books</span>
          <span className="shelf-rule" />
          <span style={{ fontSize: 12, color: "var(--text-800)" }}>Recent first</span>
        </div>

        <ul className="shelf-list">
          {!loaded && [0, 1, 2].map((i) => <li key={i} className="skeleton" style={{ height: 84 }} />)}

          {books.map((b) => {
            const row = shelfRow(b);
            const spine = spineColour(b.id);
            return (
              <li key={b.id} className="shelf-row fade-in" data-state={row.state}>
                <span className="shelf-spine" style={{ background: spine, color: spineInk(spine) }} aria-hidden="true" />

                <span className="shelf-main" style={{ flex: 1, minWidth: 0 }}>
                  <span className="shelf-titleline" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {row.openable ? (
                      <Link href={`/reader/${b.id}`} className="shelf-title">
                        {b.title}
                      </Link>
                    ) : (
                      <span className="shelf-title">{b.title}</span>
                    )}
                    <span className="badge shelf-badge">{row.label}</span>
                  </span>

                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-700)", margin: "3px 0 8px" }}>
                    {row.meta}
                  </span>

                  <span className="shelf-bar" aria-hidden="true">
                    <span style={{ width: `${row.percent}%` }} />
                  </span>
                </span>

                <span className="shelf-right tabular">{row.right}</span>

                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {/*
                    Ingestion is resumable, so this is safe to press at any time:
                    on a failed book it starts over, and on one that stalled
                    mid-way it picks up from the pages already embedded.
                  */}
                  {(b.status === "failed" || inFlight(b.status)) && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => onRetry(b.id)}
                      disabled={retrying === b.id}
                      title={
                        b.status === "failed"
                          ? "Process this book again"
                          : "Pick up where processing left off"
                      }
                    >
                      {retrying === b.id ? "Working…" : b.status === "failed" ? "Retry" : "Resume"}
                    </button>
                  )}
                  {confirmDelete === b.id ? (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => onDelete(b.id)}
                      disabled={deleting === b.id}
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      className="btn-text"
                      onClick={() => armDelete(b.id)}
                      disabled={deleting === b.id}
                    >
                      {deleting === b.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {loaded && books.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-700)", marginTop: "auto" }}>
            Nothing here yet? Start with{" "}
            <Link href="/catalog?q=Meditations">Meditations</Link>
            <span className="shelf-dot" />
            <Link href="/catalog?q=Walden">Walden</Link>
            <span className="shelf-dot" />
            <Link href="/catalog?q=Frankenstein">Frankenstein</Link>
          </p>
        )}
      </main>
    </div>
  );
}
