"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Icon from "../components/Icon";
import AppRail from "../components/AppRail";

interface Source {
  bookId: string;
  bookTitle: string;
  pages: number[];
}

type Status = "idle" | "loading" | "streaming" | "error";

export default function AskLibraryPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [asked, setAsked] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async () => {
    const q = question.trim();
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
    <main className="ask-page">
      <div className="ask-head">
        <Link href="/" className="btn-ghost btn-sm" style={{ whiteSpace: "nowrap" }}>
          <Icon name="arrow-left" /> Library
        </Link>
        <h1 className="wordmark" style={{ fontSize: "1.6rem", margin: 0 }}>
          <Icon name="search" /> Ask your library
        </h1>
      </div>
      <p className="ask-intro">
        Ask a question and get an answer grounded in passages drawn from across <em>all</em> your books — with the
        sources it drew on.
      </p>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <textarea
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How do these authors think about justice?"
          rows={3}
          style={{ resize: "vertical" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run();
            }
          }}
        />
        <button className="btn-primary" type="submit" disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && (
        <p role="alert" className="fade-in" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {status === "loading" && (
        <p style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="spinner" /> Searching your library…
        </p>
      )}

      {answer && (
        <div className="ask-answer card fade-in">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      )}

      {sources.length > 0 && (
        <div className="ask-sources fade-in">
          <h2>Sources</h2>
          <ul>
            {sources.map((s) => (
              <li key={s.bookId}>
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
        </div>
      )}

      {asked && !busy && !answer && !error && sources.length === 0 && (
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
          No passages matched in your library yet. Add and read a few books, then ask again.
        </p>
      )}
      </main>
    </div>
  );
}
