"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CompanionProps {
  bookId: string;
  currentPage: number;
  pendingQuestion?: string | null;
  onQuestionConsumed?: () => void;
}

export default function Companion({ bookId, currentPage, pendingQuestion, onQuestionConsumed }: CompanionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuestion = useCallback(async (question: string) => {
    if (!question || streaming) return;
    setError(null);
    setStreaming(true);
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
    <aside
      style={{
        flex: "1 1 40%",
        minWidth: 280,
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--panel)",
      }}
    >
      <h2 style={{ margin: 0, padding: "0.75rem 1rem", fontSize: "1rem", borderBottom: "1px solid var(--border)" }}>
        Companion
      </h2>

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
            <p style={{ margin: "0.25rem 0 0" }}>or select text in the book to Define · Deep Dive · ELI5.</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isTyping = streaming && i === messages.length - 1 && m.role === "assistant" && !m.content;
          return (
            <div key={i} className={`bubble fade-in ${m.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
              {isTyping ? (
                <span className="typing-dots" aria-label="Thinking…">
                  <span /><span /><span />
                </span>
              ) : m.role === "assistant" ? (
                <div className="md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
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
    </aside>
  );
}
