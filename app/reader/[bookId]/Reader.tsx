"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import Companion from "./Companion";
import SelectionTooltip from "./SelectionTooltip";
import { buildIntentQuestion } from "@/core/chat/intents.js";
import type { Intent } from "@/core/chat/intents.js";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface ReaderProps {
  bookId: string;
  title: string;
  pageCount: number;
  fileUrl: string;
  initialPage?: number;
  furthestReadPage?: number;
}

export default function Reader({ bookId, title, pageCount, fileUrl, initialPage = 1, furthestReadPage: initialFurthest = 1 }: ReaderProps) {
  const [numPages, setNumPages] = useState(pageCount);
  const [page, setPage] = useState(initialPage);
  const [furthest, setFurthest] = useState(initialFurthest);
  const [jump, setJump] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const pdfSectionRef = useRef<HTMLElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const go = (n: number) => setPage(Math.min(Math.max(1, n), numPages || pageCount));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, page }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.furthestReadPage) setFurthest(data.furthestReadPage);
        })
        .catch(() => {});
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [page, bookId]);

  const onSelectToAsk = useCallback((selection: string, intent: Intent) => {
    setPendingQuestion(buildIntentQuestion(intent, selection));
  }, []);

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
          {furthest > 1 && (
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }} title="Furthest page read sequentially">
              read to p{furthest}
            </span>
          )}
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
          ref={pdfSectionRef}
          style={{
            flex: "1 1 60%",
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            padding: "1rem",
            background: "#0f131b",
            position: "relative",
          }}
        >
          {fileUrl ? (
            <Document file={fileUrl} onLoadSuccess={onLoad} loading={<p>Loading PDF…</p>}>
              <Page pageNumber={page} renderTextLayer renderAnnotationLayer={false} width={640} />
            </Document>
          ) : (
            <p style={{ color: "#ff6b6b" }}>Could not load the file.</p>
          )}
          <SelectionTooltip containerRef={pdfSectionRef} onSelect={onSelectToAsk} />
        </section>

        <Companion
          bookId={bookId}
          currentPage={page}
          pendingQuestion={pendingQuestion}
          onQuestionConsumed={() => setPendingQuestion(null)}
        />
      </div>
    </div>
  );
}
