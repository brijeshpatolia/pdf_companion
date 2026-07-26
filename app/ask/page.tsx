"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { spineColour } from "@/core/library/shelfRow.js";
import Icon from "../components/Icon";
import AppRail from "../components/AppRail";

interface Source {
  bookId: string;
  bookTitle: string;
  pages: number[];
}

type Status = "idle" | "loading" | "streaming" | "error";

/**
 * Openings rather than examples: each one is a shape of question the
 * cross-book search is actually good at, and clicking it fills the field so
 * you can edit before asking. They are deliberately about *your* books in the
 * abstract — nothing here claims to know what you have on the shelf.
 */
const SEEDS = [
  "What do these books disagree about?",
  "Where have I read about attention?",
  "Summarise what I've read on ethics",
];

export default function AskLibraryPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [asked, setAsked] = useState(false);
  const busyRef = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async (override?: string) => {
    const q = (override ?? question).trim();
    if (!q || busyRef.current) return;
    busyRef.current = true;
    setAnswer("");
    setSources([]);
    setError("");
    setAsked(true);
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
          if (evt.type === "sources") setSources(evt.sources ?? []);
          else if (evt.type === "chunk") setAnswer((a) => a + (evt.text ?? ""));
          else if (evt.type === "error") {
            setError(evt.message || "Something went wrong.");
            setStatus("error");
          }
        }
      }
      setStatus((s) => (s === "error" ? s : "idle"));
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    } finally {
      busyRef.current = false;
    }
  }, [question]);

  const busy = status === "loading" || status === "streaming";

  return (
    <div className="rail-layout">
      <AppRail />
      <main className="ask-page" data-state={asked ? "asked" : "blank"}>
        <header className="page-head">
          <div style={{ minWidth: 0 }}>
            <h1>Ask your library</h1>
            <p>
              One question, answered from passages drawn across <em>every</em> book you own — with
              the pages it read to answer.
            </p>
          </div>
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

        {!asked && (
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

        {status === "loading" && (
          <p
            style={{
              color: "var(--text-600)",
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginTop: 26,
              fontSize: 14,
            }}
          >
            <span className="spinner" /> Searching your library…
          </p>
        )}

        {answer && (
          <div className="ask-answer md fade-in">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        )}

        {sources.length > 0 && (
          <section className="fade-in">
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
                      <Link
                        key={pg}
                        href={`/reader/${s.bookId}?page=${pg}`}
                        className="ask-source-page"
                      >
                        p. {pg}
                      </Link>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {asked && !busy && !answer && !error && sources.length === 0 && (
          <div className="empty-state" style={{ marginTop: 26 }}>
            <Icon name="search" size={26} />
            <p>
              Nothing in your library matched that yet. Add a few books and read a little, then ask
              again.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
