"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BookSummary {
  id: string;
  title: string;
  page_count: number;
  status: string;
}

export default function Home() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [busy, setBusy] = useState(false);
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

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
        {books.map((b) => (
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
            }}
          >
            <span>
              <Link href={`/reader/${b.id}`}>{b.title}</Link>
              <span style={{ color: "var(--muted)" }}> · {b.page_count} pages · {b.status}</span>
            </span>
          </li>
        ))}
        {books.length === 0 && (
          <li style={{ color: "var(--muted)" }}>No books yet — upload one to start reading.</li>
        )}
      </ul>
    </main>
  );
}
