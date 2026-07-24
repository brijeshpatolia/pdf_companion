"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Notes from "./Notes";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SavedItem {
  id: string;
  bookId: string;
  kind: "highlight" | "answer";
  page: number;
  text: string;
  question?: string;
  createdAt: string;
}

interface CompanionProps {
  bookId: string;
  currentPage: number;
  pendingQuestion?: string | null;
  onQuestionConsumed?: () => void;
  /** Bumped by the reader whenever it creates a saved item (e.g. a highlight). */
  savedVersion?: number;
  onJumpToPage?: (page: number) => void;
  /** On narrow screens the reader toggles between panes; true hides this one. */
  mobileHidden?: boolean;
}

export default function Companion({
  bookId,
  currentPage,
  pendingQuestion,
  onQuestionConsumed,
  savedVersion = 0,
  onJumpToPage,
  mobileHidden = false,
}: CompanionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [tab, setTab] = useState<"chat" | "saved" | "notes">("chat");
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [savingText, setSavingText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chat?bookId=${bookId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bookId]);

  const refreshSaved = useCallback(async () => {
    try {
      const res = await fetch(`/api/saved?bookId=${bookId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setSaved(data);
      }
    } catch {}
  }, [bookId]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved, savedVersion]);

  useEffect(() => {
    if (tab === "chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  const sendQuestion = useCallback(async (question: string) => {
    if (!question || streaming) return;
    setError(null);
    setStreaming(true);
    setTab("chat");
    lastQuestionRef.current = question;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, currentPage, question }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(trimmed.slice(6));
          } catch {
            continue;
          }

          if (parsed.type === "chunk") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, content: last.content + parsed.text };
              }
              return updated;
            });
          } else if (parsed.type === "error") {
            setError({ code: parsed.code, message: parsed.message });
            setMessages((prev) => prev.slice(0, -1));
          }
        }
      }
    } catch (err: unknown) {
      if ((err as any)?.name === "AbortError") {
        // Stopped by the user — keep the partial answer, drop an empty bubble.
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === "assistant" && last.content === "" ? prev.slice(0, -1) : prev;
        });
      } else {
        setError({ code: "gateway-error", message: err instanceof Error ? err.message : "Unknown error" });
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, bookId, currentPage]);

  const send = useCallback(() => {
    const question = input.trim();
    if (!question) return;
    setInput("");
    sendQuestion(question);
  }, [input, sendQuestion]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (lastQuestionRef.current) {
      // The failed exchange was already removed from the thread; drop the
      // orphaned user turn before resending so it isn't duplicated.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === "user" ? prev.slice(0, -1) : prev;
      });
      sendQuestion(lastQuestionRef.current);
    }
  }, [sendQuestion]);

  const isAnswerSaved = useCallback(
    (content: string) => saved.some((s) => s.kind === "answer" && s.text === content),
    [saved],
  );

  const saveAnswer = useCallback(
    async (content: string, question?: string) => {
      if (savingText || isAnswerSaved(content)) return;
      setSavingText(content);
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, kind: "answer", page: currentPage, text: content, question }),
        });
        if (res.ok) await refreshSaved();
      } catch {} finally {
        setSavingText(null);
      }
    },
    [bookId, currentPage, savingText, isAnswerSaved, refreshSaved],
  );

  const deleteSaved = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/saved?id=${id}`, { method: "DELETE" });
        await refreshSaved();
      } catch {}
    },
    [refreshSaved],
  );

  const [exporting, setExporting] = useState(false);
  const exportBook = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?bookId=${bookId}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "book.md";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {} finally {
      setExporting(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (pendingQuestion && !streaming) {
      sendQuestion(pendingQuestion);
      onQuestionConsumed?.();
    }
  }, [pendingQuestion, streaming, sendQuestion, onQuestionConsumed]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <aside className={`pane-companion${mobileHidden ? " hidden-narrow" : ""}`}>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        <button className={`tab${tab === "chat" ? " active" : ""}`} onClick={() => setTab("chat")}>
          Chat
        </button>
        <button className={`tab${tab === "saved" ? " active" : ""}`} onClick={() => setTab("saved")}>
          Saved{saved.length > 0 ? ` (${saved.length})` : ""}
        </button>
        <button className={`tab${tab === "notes" ? " active" : ""}`} onClick={() => setTab("notes")}>
          Notes{notesCount > 0 ? ` (${notesCount})` : ""}
        </button>
      </div>

      {tab === "chat" ? (
        <>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {messages.length === 0 && !error && (
              <div style={{ color: "var(--muted)", textAlign: "center", marginTop: "2rem", fontSize: "0.9rem" }}>
                <p style={{ margin: 0 }}>Ask a question about page {currentPage},</p>
                <p style={{ margin: "0.25rem 0 0" }}>or select text in the book to Highlight · Define · Deep Dive · ELI5.</p>
              </div>
            )}

            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isTyping = streaming && isLast && m.role === "assistant" && !m.content;
              const showSave =
                m.role === "assistant" && m.content && !(streaming && isLast);
              const question = messages[i - 1]?.role === "user" ? messages[i - 1]!.content : undefined;
              return (
                <div key={i} className={`bubble fade-in ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
                  {isTyping ? (
                    <span className="typing-dots" aria-label="Thinking…">
                      <span /><span /><span />
                    </span>
                  ) : m.role === "assistant" ? (
                    <>
                      <div className="md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                      {showSave && (
                        <div style={{ marginTop: "0.35rem", textAlign: "right" }}>
                          <button
                            className={`save-btn${isAnswerSaved(m.content) ? " saved" : ""}`}
                            onClick={() => saveAnswer(m.content, question)}
                            disabled={savingText === m.content}
                            title={isAnswerSaved(m.content) ? "Saved" : "Save this answer"}
                          >
                            {isAnswerSaved(m.content) ? "★ Saved" : savingText === m.content ? "Saving…" : "☆ Save"}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              );
            })}

            {error && (
              <div
                role="alert"
                className="card fade-in"
                style={{
                  borderColor: "rgba(239, 68, 68, 0.45)",
                  background: "var(--danger-soft)",
                  padding: "0.75rem",
                  fontSize: "0.85rem",
                }}
              >
                <strong style={{ color: "var(--danger)" }}>
                  {error.code === "missing-key" ? "API Key Required" : "Error"}
                </strong>
                <p style={{ margin: "0.25rem 0 0", color: "var(--danger)" }}>{error.message}</p>
                {error.code === "gateway-error" && (
                  <button className="btn-danger btn-sm" onClick={retry} style={{ marginTop: "0.5rem" }}>
                    Retry
                  </button>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              display: "flex",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about page ${currentPage}…`}
              disabled={streaming}
              aria-label="Ask a question"
              style={{ flex: 1, fontSize: "0.9rem" }}
            />
            {streaming ? (
              <button type="button" className="btn-danger" onClick={stop} aria-label="Stop generating">
                ◼ Stop
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={!input.trim()} aria-label="Send question">
                Ask
              </button>
            )}
          </form>
        </>
      ) : tab === "notes" ? (
        <Notes
          bookId={bookId}
          currentPage={currentPage}
          onJumpToPage={onJumpToPage}
          onCountChange={setNotesCount}
        />
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn-ghost btn-sm"
              onClick={exportBook}
              disabled={exporting}
              title="Download highlights, saved answers, and notes as Markdown"
            >
              {exporting ? "Exporting…" : "⬇ Export book"}
            </button>
          </div>

          {saved.length === 0 && (
            <div style={{ color: "var(--muted)", textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}>
              <p style={{ margin: 0, fontSize: "1.3rem" }}>✦</p>
              <p style={{ margin: "0.5rem 0 0" }}>
                Nothing saved yet — highlight a passage in the book, or save an answer worth keeping.
              </p>
            </div>
          )}

          {saved.map((item) => (
            <div key={item.id} className="card saved-card fade-in">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.35rem",
                }}
              >
                <span className={`badge ${item.kind === "highlight" ? "badge-warn" : "badge-info"}`}>
                  {item.kind === "highlight" ? "✦ Highlight" : "💬 Answer"}
                </span>
                <button
                  className="page-chip"
                  onClick={() => onJumpToPage?.(item.page)}
                  title={`Go to page ${item.page}`}
                >
                  p. {item.page}
                </button>
                <span style={{ flex: 1 }} />
                <button
                  className="save-btn"
                  onClick={() => deleteSaved(item.id)}
                  aria-label="Remove saved item"
                  title="Remove"
                >
                  ✕
                </button>
              </div>

              {item.question && (
                <p style={{ margin: "0 0 0.3rem", color: "var(--muted)", fontStyle: "italic" }}>
                  “{item.question}”
                </p>
              )}

              <div
                className={`saved-text${expanded[item.id] ? "" : " collapsed"}`}
                onClick={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                title={expanded[item.id] ? "Collapse" : "Expand"}
              >
                {item.kind === "answer" ? (
                  <div className="md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
                  </div>
                ) : (
                  item.text
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
