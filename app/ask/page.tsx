"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { spineColour } from "@/core/library/shelfRow.js";
import {
  toExchanges,
  newestFirst,
  type Exchange,
  type Source,
  type StoredMessage,
} from "@/core/library/thread.js";
import Icon from "../components/Icon";
import AppRail from "../components/AppRail";

type Status = "idle" | "loading" | "streaming" | "error";

/**
 * Openings rather than examples: each is a shape of question the cross-book
 * search is actually good at, and clicking one fills the field so you can edit
 * before asking. They're deliberately abstract — nothing here claims to know
 * what's on your shelf.
 */
const SEEDS = [
  "What do these books disagree about?",
  "Where have I read about attention?",
  "Summarise what I've read on ethics",
];

export default function AskLibraryPage() {
  const [question, setQuestion] = useState("");
  const [past, setPast] = useState<Exchange[]>([]);
  const [loadedHistory, setLoadedHistory] = useState(false);

  /** The exchange being streamed right now, which isn't in `past` yet. */
  const [live, setLive] = useState<{ question: string; answer: string; sources: Source[] } | null>(
    null,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  const busyRef = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // The thread outlives the tab now, so it has to be fetched before anything
  // is drawn — otherwise a reload looks exactly like a fresh, empty page.
  useEffect(() => {
    fetch("/api/ask")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { messages?: StoredMessage[] }) => setPast(toExchanges(d.messages ?? [])))
      .catch(() => {})
      .finally(() => setLoadedHistory(true));
  }, []);

  const run = useCallback(
    async (override?: string) => {
      const q = (override ?? question).trim();
      if (!q || busyRef.current) return;
      busyRef.current = true;
      setError("");
      setLive({ question: q, answer: "", sources: [] });
      setQuestion("");
      setStatus("loading");

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        setStatus("streaming");

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            let evt: { type: string; text?: string; sources?: Source[]; message?: string };
            try {
              evt = JSON.parse(json);
            } catch {
              continue;
            }
            if (evt.type === "sources") {
              setLive((l) => (l ? { ...l, sources: evt.sources ?? [] } : l));
            } else if (evt.type === "chunk") {
              setLive((l) => (l ? { ...l, answer: l.answer + (evt.text ?? "") } : l));
            } else if (evt.type === "error") {
              setError(evt.message || "Something went wrong.");
              setStatus("error");
            }
          }
        }

        // Move the finished exchange into the thread. The server has already
        // stored it, so this only has to match what a reload would show.
        setLive((l) => {
          if (l) {
            setPast((p) => [
              ...p,
              {
                id: `local-${Date.now()}`,
                question: l.question,
                answer: l.answer,
                sources: l.sources,
                unanswered: l.answer.length === 0,
              },
            ]);
          }
          return null;
        });
        setStatus((s) => (s === "error" ? s : "idle"));
      } catch (err) {
        setError((err as Error).message);
        setStatus("error");
        // Keep the question visible with whatever arrived before it failed.
        setLive((l) => l);
      } finally {
        busyRef.current = false;
      }
    },
    [question],
  );

  async function clearThread() {
    setClearing(true);
    try {
      await fetch("/api/ask", { method: "DELETE" });
      setPast([]);
      setLive(null);
    } catch {
      setError("Couldn't clear the thread.");
    } finally {
      setClearing(false);
    }
  }

  const busy = status === "loading" || status === "streaming";
  const thread = newestFirst(past);
  const blank = loadedHistory && past.length === 0 && !live;

  return (
    <div className="rail-layout">
      <AppRail />
      <main className="ask-page" data-state={blank ? "blank" : "asked"}>
        <header className="page-head">
          <div style={{ minWidth: 0 }}>
            <h1>Ask your library</h1>
            <p>
              Questions answered from passages drawn across <em>every</em> book you own — with the
              pages they came from.
            </p>
          </div>
          {past.length > 0 && (
            <button className="btn-text" onClick={clearThread} disabled={clearing}>
              {clearing ? "Clearing…" : "Clear thread"}
            </button>
          )}
        </header>

        <form
          className="ask-field"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <textarea
            ref={fieldRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="How do these authors think about justice?"
            rows={2}
            aria-label="Your question"
            onKeyDown={(e) => {
              // Enter alone would fight the multi-line field.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void run();
              }
            }}
          />
          <div className="ask-field-foot">
            <span className="ask-shortcut">
              <kbd>⌘</kbd> <kbd>↵</kbd> to ask
            </span>
            <button className="btn-primary" type="submit" disabled={busy || !question.trim()}>
              {busy ? (
                <>
                  <span className="spinner" /> Reading
                </>
              ) : (
                <>
                  Ask <Icon name="arrow-right" />
                </>
              )}
            </button>
          </div>
        </form>

        {blank && (
          <div className="ask-seeds">
            {SEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className="ask-seed"
                onClick={() => {
                  setQuestion(s);
                  fieldRef.current?.focus();
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="fade-in" style={{ color: "var(--danger)", marginTop: 22 }}>
            {error}
          </p>
        )}

        {live && <ExchangeView exchange={{ ...live, id: "live", unanswered: false }} streaming />}

        {thread.map((e) => (
          <ExchangeView key={e.id} exchange={e} />
        ))}
      </main>
    </div>
  );
}

function ExchangeView({ exchange, streaming }: { exchange: Exchange; streaming?: boolean }) {
  const { question, answer, sources, unanswered } = exchange;

  return (
    <article className="ask-exchange fade-in">
      {question && <p className="ask-question">{question}</p>}

      {answer ? (
        <div className="ask-answer md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      ) : streaming ? (
        <p className="ask-waiting">
          <span className="spinner" /> Searching your library…
        </p>
      ) : unanswered ? (
        // A question whose answer never arrived. Saying so beats leaving a
        // question hanging with nothing under it.
        <p className="ask-waiting">No answer was saved for this one.</p>
      ) : null}

      {sources.length > 0 && (
        <>
          <h2 className="section-label">Read to answer</h2>
          <ul className="ask-sources">
            {sources.map((s) => (
              <li key={s.bookId} className="ask-source">
                <span
                  className="ask-source-spine"
                  aria-hidden="true"
                  style={{ background: spineColour(s.bookId) }}
                />
                <span className="ask-source-title">{s.bookTitle}</span>
                <span className="ask-source-pages">
                  {s.pages.map((pg) => (
                    <Link key={pg} href={`/reader/${s.bookId}?page=${pg}`} className="ask-source-page">
                      p. {pg}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
