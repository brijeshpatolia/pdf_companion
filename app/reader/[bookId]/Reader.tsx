"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import Companion from "./Companion";
import SelectionTooltip from "./SelectionTooltip";
import EpubPage from "./EpubPage";
import RoomBar from "./RoomBar";
import ShareCardPanel from "./ShareCardPanel";
import { useReadingRoom } from "./useReadingRoom";
import { usePageTurn } from "./usePageTurn";
import { markHighlights } from "@/core/reading/markHighlights.js";
import { buildIntentQuestion } from "@/core/chat/intents.js";
import type { Intent } from "@/core/chat/intents.js";
import Icon from "../../components/Icon";

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
  const [sharingCard, setSharingCard] = useState(false);
  /** Highlight text for the current page, painted onto the page itself. */
  const [pageHighlights, setPageHighlights] = useState<string[]>([]);
  const pdfSectionRef = useRef<HTMLElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The page as of *now*, which during a burst of taps runs ahead of the page
   * React has committed. A turn copies the page you were actually looking at,
   * so it has to read from here rather than from state.
   */
  const pageRef = useRef(page);

  const turn = usePageTurn();
  const { start: startTurn } = turn;

  /**
   * The one door every page change goes through — the pager, the arrow keys,
   * the jump box, a citation in the companion, someone else's page turn in a
   * reading room. The turn is started from here, before the state changes,
   * because it works by copying the page that is still on screen.
   */
  const go = useCallback(
    (n: number) => {
      const target = Math.min(Math.max(1, n), numPages || pageCount);
      const from = pageRef.current;
      if (target === from) return;
      pageRef.current = target;
      startTurn(from, target);
      setPage(target);
    },
    [numPages, pageCount, startTurn],
  );

  // `go` keeps this current on its own; this is here so that a page arriving
  // from anywhere else can't leave the two disagreeing about where we are.
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const room = useReadingRoom({
    token: roomToken,
    userId,
    name: readerName,
    page,
    // Following means their page turns become yours.
    onFollow: (n) => go(n),
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/saved?bookId=${bookId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (cancelled || !Array.isArray(items)) return;
        setPageHighlights(
          items
            .filter((i: { kind: string; page: number }) => i.kind === "highlight" && i.page === page)
            .map((i: { text: string }) => i.text),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bookId, page, savedVersion]);

  // What the others in the room have marked on this page. Broadcast-only, so
  // it lives as long as the room does and is never written to your account.
  const peerHighlights = useMemo(
    () => room.liveHighlights.filter((h) => h.page === page).map((h) => h.text),
    [room.liveHighlights, page],
  );

  // react-pdf hands each text fragment through this and assigns the result as
  // innerHTML, so the marker escapes everything it returns.
  const textRenderer = useCallback(
    ({ str }: { str: string }) => markHighlights(str, pageHighlights, peerHighlights),
    [pageHighlights, peerHighlights],
  );

  const onLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

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
        go(pageRef.current - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(pageRef.current + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

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
        showFlash("Highlight saved", true);
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
      <header className="reader-bar">
        <Link href="/" className="reader-back">
          <Icon name="chevron-left" /> Library
        </Link>
        <span className="reader-divider" aria-hidden="true" />
        <span style={{ minWidth: 0 }}>
          <span className="reader-title">{title}</span>
        </span>

        <span className="reader-spacer" />

        {flash && (
          <span className={`badge ${flash.ok ? "badge-ok" : "badge-danger"} fade-in`} role="status">
            {flash.text}
          </span>
        )}

        {/* One control for where you are and how to move — a pager, not three
            separate buttons pretending to be unrelated. */}
        <span className="pager">
          <button
            className="pager-step"
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            title="Previous page (←)"
          >
            <Icon name="chevron-left" />
          </button>
          <span className="pager-count tabular">
            <span>{page}</span>
            <span className="pager-total">/ {numPages || pageCount}</span>
          </span>
          <button
            className="pager-step"
            onClick={() => go(page + 1)}
            disabled={page >= (numPages || pageCount)}
            aria-label="Next page"
            title="Next page (→)"
          >
            <Icon name="chevron-right" />
          </button>
        </span>

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
        </form>

        <Link href={`/reader/${bookId}/flashcards`} className="btn-ghost btn-sm">
          Flashcards
        </Link>
        <button
          className="btn-primary btn-sm"
          onClick={() => setSharingCard(true)}
          title="Make a shareable card from this book"
        >
          Share
        </button>
      </header>

      {/* reading progress */}
      <div className="progress-track" aria-hidden="true">
        <div
          className="progress-fill"
          style={{ width: `${(page / (numPages || pageCount || 1)) * 100}%` }}
        />
      </div>

      {/* co-reading: who else is in this book right now */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <RoomBar
          bookId={bookId}
          token={roomToken}
          onTokenChange={setRoomToken}
          connected={room.connected}
          participants={room.participants}
          liveHighlights={room.liveHighlights}
          following={room.following}
          onFollowChange={room.setFollowing}
          onJumpToPage={(n) => {
            go(n);
            setMobileView("book");
          }}
          isGuest={joinedRoomToken !== null}
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
          <Icon name="book" /> Book
        </button>
        <button
          role="tab"
          aria-selected={mobileView === "chat"}
          className={`tab${mobileView === "chat" ? " active" : ""}`}
          onClick={() => setMobileView("chat")}
        >
          <Icon name="chat" /> Companion
        </button>
      </div>

      {/* split view: reader | companion */}
      <div className="reader-split">
        <section
          ref={pdfSectionRef}
          className={`pane-book${mobileView === "chat" ? " hidden-narrow" : ""}`}
        >
          {/*
            The page is the only lit object on screen. A PDF brings its own
            paper — the rendered canvas — so the wrapper supplies the shadow
            and running head around it; an EPUB has none, so the wrapper is
            the paper.
          */}
          {/* The stage the turn happens on: the live page, and the copy of the
              one you are leaving or returning to. */}
          <div className="page-stage">
            <div
              ref={turn.paperRef}
              className={`paper reader-paper${format === "epub" ? " is-text" : ""}${turn.arriving ? " is-arriving" : ""}`}
            >
              <div className="paper-running-head" aria-hidden="true">
                <span>{title}</span>
                <span className="tabular">{page}</span>
              </div>

              {format === "epub" ? (
                // Keyed by page so a page already fetched arrives with its text
                // in place, instead of mounting empty and filling in a frame
                // later — a turn that lands on a spinner is not a page turn.
                <EpubPage
                  key={`${bookId}:${page}`}
                  bookId={bookId}
                  page={page}
                  highlights={pageHighlights}
                  peerHighlights={peerHighlights}
                />
              ) : fileUrl ? (
                <Document
                  file={fileUrl}
                  onLoadSuccess={onLoad}
                  loading={
                    <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--paper-meta)" }}>
                      <span className="spinner" /> Loading page…
                    </p>
                  }
                >
                  <Page
                    pageNumber={page}
                    renderTextLayer
                    renderAnnotationLayer={false}
                    width={pageWidth}
                    customTextRenderer={textRenderer}
                  />
                </Document>
              ) : (
                <p style={{ color: "var(--danger)" }}>Could not load the file.</p>
              )}
            </div>

            {/* Where the copy goes. React never puts anything in here — the
                turn does, and takes it out again when the page has settled. */}
            <div
              ref={turn.leafRef}
              className={`page-leaf${turn.arriving ? " is-behind" : ""}`}
              aria-hidden="true"
            />
          </div>

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

      {sharingCard && (
        <ShareCardPanel
          bookId={bookId}
          title={title}
          page={page}
          onClose={() => setSharingCard(false)}
        />
      )}
    </div>
  );
}
