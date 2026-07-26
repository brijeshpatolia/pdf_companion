"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import Companion from "./Companion";
import SelectionTooltip from "./SelectionTooltip";
import EpubPage from "./EpubPage";
import RoomBar from "./RoomBar";
import { useReadingRoom } from "./useReadingRoom";
import { buildIntentQuestion } from "@/core/chat/intents.js";
import type { Intent } from "@/core/chat/intents.js";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface ReaderProps {
  bookId: string;
  title: string;
  pageCount: number;
  format?: "pdf" | "epub";
  fileUrl: string;
  initialPage?: number;
  furthestReadPage?: number;
  userId: string;
  readerName: string;
  /** Set when this reader arrived through someone else's room link. */
  joinedRoomToken?: string | null;
}

export default function Reader({ bookId, title, pageCount, format = "pdf", fileUrl, initialPage = 1, furthestReadPage: initialFurthest = 1, userId, readerName, joinedRoomToken = null }: ReaderProps) {
  const [numPages, setNumPages] = useState(pageCount);
  const [page, setPage] = useState(initialPage);
  const [furthest, setFurthest] = useState(initialFurthest);
  const [jump, setJump] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"book" | "chat">("book");
  const [pageWidth, setPageWidth] = useState(640);
  const [savedVersion, setSavedVersion] = useState(0);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(joinedRoomToken);
  const pdfSectionRef = useRef<HTMLElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const room = useReadingRoom({ token: roomToken, userId, name: readerName, page });

  const onLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const go = useCallback(
    (n: number) => setPage(Math.min(Math.max(1, n), numPages || pageCount)),
    [numPages, pageCount],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPage((p) => Math.min(numPages || pageCount, p + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numPages, pageCount]);

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
    setMobileView("chat"); // on narrow screens, surface the answer
  }, []);

  const showFlash = useCallback((text: string, ok: boolean) => {
    setFlash({ text, ok });
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlash(null), 2500);
  }, []);

  const onHighlight = useCallback(
    async (selection: string) => {
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, kind: "highlight", page, text: selection }),
        });
        if (!res.ok) throw new Error();
        setSavedVersion((v) => v + 1);
        // Anyone reading along sees it appear. Broadcast only — it stays in
        // this reader's account, and is never written to anyone else's.
        room.shareHighlight(selection, page);
        showFlash("Highlight saved ✓", true);
      } catch {
        showFlash("Couldn't save highlight", false);
      }
    },
    [bookId, page, showFlash, room],
  );

  useEffect(() => {
    return () => {
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, []);

  // Fit the PDF page to the pane on narrow screens (640px cap on desktop).
  useEffect(() => {
    const el = pdfSectionRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 100) setPageWidth(Math.min(640, w - 24));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
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
        className="reader-header"
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
        <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </strong>
        <Link href={`/reader/${bookId}/flashcards`} className="btn-ghost btn-sm" style={{ whiteSpace: "nowrap" }}>
          🃏 Flashcards
        </Link>
        <span style={{ flex: 1 }} />
        {flash && (
          <span className={`badge ${flash.ok ? "badge-ok" : "badge-danger"} fade-in`} role="status">
            {flash.text}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            title="Previous page (←)"
          >
            ‹ Prev
          </button>
          <span style={{ color: "var(--muted)", minWidth: 90, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            Page {page} / {numPages || pageCount}
          </span>
          {furthest > 1 && (
            <span className="badge badge-info" title="Furthest page read sequentially">
              read to p{furthest}
            </span>
          )}
          <button
            onClick={() => go(page + 1)}
            disabled={page >= (numPages || pageCount)}
            aria-label="Next page"
            title="Next page (→)"
          >
            Next ›
          </button>
          <form onSubmit={onJump} className="jump-form">
            <input
              className="input"
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              inputMode="numeric"
              placeholder="Go to…"
              aria-label="Jump to page"
              style={{ width: 70 }}
            />
            <button type="submit">Go</button>
          </form>
        </div>
      </header>

      {/* co-reading: who else is in this book right now */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <RoomBar
          bookId={bookId}
          token={roomToken}
          onTokenChange={setRoomToken}
          connected={room.connected}
          participants={room.participants}
          liveHighlights={room.liveHighlights}
          onJumpToPage={(n) => {
            go(n);
            setMobileView("book");
          }}
          isGuest={joinedRoomToken !== null}
        />
      </div>

      {/* reading progress */}
      <div className="progress-track" aria-hidden="true">
        <div
          className="progress-fill"
          style={{ width: `${(page / (numPages || pageCount || 1)) * 100}%` }}
        />
      </div>

      {/* Book/Chat switcher (narrow screens only) */}
      <div className="mobile-toggle" role="tablist" aria-label="Reader view">
        <button
          role="tab"
          aria-selected={mobileView === "book"}
          className={`tab${mobileView === "book" ? " active" : ""}`}
          onClick={() => setMobileView("book")}
        >
          📖 Book
        </button>
        <button
          role="tab"
          aria-selected={mobileView === "chat"}
          className={`tab${mobileView === "chat" ? " active" : ""}`}
          onClick={() => setMobileView("chat")}
        >
          💬 Companion
        </button>
      </div>

      {/* split view: reader | companion */}
      <div className="reader-split">
        <section
          ref={pdfSectionRef}
          className={`pane-book${mobileView === "chat" ? " hidden-narrow" : ""}`}
        >
          {format === "epub" ? (
            <EpubPage bookId={bookId} page={page} />
          ) : fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={onLoad}
              loading={
                <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--muted)" }}>
                  <span className="spinner" /> Loading PDF…
                </p>
              }
            >
              <Page pageNumber={page} renderTextLayer renderAnnotationLayer={false} width={pageWidth} />
            </Document>
          ) : (
            <p style={{ color: "var(--danger)" }}>Could not load the file.</p>
          )}
          <SelectionTooltip
            containerRef={pdfSectionRef}
            onSelect={onSelectToAsk}
            onHighlight={onHighlight}
          />
        </section>

        <Companion
          bookId={bookId}
          currentPage={page}
          pendingQuestion={pendingQuestion}
          onQuestionConsumed={() => setPendingQuestion(null)}
          savedVersion={savedVersion}
          onJumpToPage={(n) => {
            go(n);
            setMobileView("book");
          }}
          mobileHidden={mobileView === "book"}
        />
      </div>
    </div>
  );
}
