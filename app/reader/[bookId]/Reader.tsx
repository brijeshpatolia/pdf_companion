"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Serve the worker from /public so its version matches react-pdf's pdfjs
// exactly (see scripts: worker is copied there from node_modules).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface ReaderProps {
  title: string;
  pageCount: number;
  fileUrl: string;
}

export default function Reader({ title, pageCount, fileUrl }: ReaderProps) {
  const [numPages, setNumPages] = useState(pageCount);
  const [page, setPage] = useState(1);
  const [jump, setJump] = useState("");

  const onLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const go = (n: number) => setPage((p) => Math.min(Math.max(1, n), numPages || pageCount));

  const onJump = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jump, 10);
    if (!Number.isNaN(n)) go(n);
    setJump("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0.6rem 1rem",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <Link href="/">← Library</Link>
        <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </strong>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
            ‹ Prev
          </button>
          <span style={{ color: "var(--muted)", minWidth: 90, textAlign: "center" }}>
            Page {page} / {numPages || pageCount}
          </span>
          <button onClick={() => go(page + 1)} disabled={page >= (numPages || pageCount)} aria-label="Next page">
            Next ›
          </button>
          <form onSubmit={onJump} style={{ display: "flex", gap: "0.3rem" }}>
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              inputMode="numeric"
              placeholder="Go to…"
              aria-label="Jump to page"
              style={{
                width: 70,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                padding: "0.35rem 0.5rem",
              }}
            />
            <button type="submit">Go</button>
          </form>
        </div>
      </header>

      {/* split view: reader | companion */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <section
          style={{
            flex: "1 1 60%",
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            padding: "1rem",
            background: "#0f131b",
          }}
        >
          {fileUrl ? (
            <Document file={fileUrl} onLoadSuccess={onLoad} loading={<p>Loading PDF…</p>}>
              <Page pageNumber={page} renderTextLayer renderAnnotationLayer={false} width={640} />
            </Document>
          ) : (
            <p style={{ color: "#ff6b6b" }}>Could not load the file.</p>
          )}
        </section>

        <aside
          style={{
            flex: "1 1 40%",
            minWidth: 280,
            borderLeft: "1px solid var(--border)",
            padding: "1rem",
            background: "var(--panel)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Companion</h2>
          <p style={{ color: "var(--muted)" }}>
            The AI companion lands in a later slice. It will read along with you, always on
            this page, remembering everything you&apos;ve read.
          </p>
        </aside>
      </div>
    </div>
  );
}
