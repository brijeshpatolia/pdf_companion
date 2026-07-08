"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CompanionProps {
  bookId: string;
  currentPage: number;
}

export default function Companion({ bookId, currentPage }: CompanionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || streaming) return;

    setInput("");
    setError(null);
    setStreaming(true);

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
      if ((err as any)?.name !== "AbortError") {
        setError({ code: "gateway-error", message: err instanceof Error ? err.message : "Unknown error" });
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, bookId, currentPage]);

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
          <p style={{ color: "var(--muted)", textAlign: "center", marginTop: "2rem" }}>
            Ask a question about page {currentPage}
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--accent, #2563eb)" : "var(--surface, #1e293b)",
              color: m.role === "user" ? "#fff" : "var(--text)",
              padding: "0.5rem 0.75rem",
              borderRadius: 12,
              maxWidth: "85%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.9rem",
              lineHeight: 1.5,
            }}
          >
            {m.content || (streaming && i === messages.length - 1 ? "..." : "")}
          </div>
        ))}

        {error && (
          <div
            role="alert"
            style={{
              background: "#2d1b1b",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
              padding: "0.75rem",
              fontSize: "0.85rem",
            }}
          >
            <strong style={{ color: "#fca5a5" }}>
              {error.code === "missing-key" ? "API Key Required" : "Error"}
            </strong>
            <p style={{ margin: "0.25rem 0 0", color: "#fecaca" }}>{error.message}</p>
            {error.code === "gateway-error" && (
              <button
                onClick={send}
                style={{
                  marginTop: "0.5rem",
                  background: "#7f1d1d",
                  color: "#fecaca",
                  border: "none",
                  borderRadius: 6,
                  padding: "0.3rem 0.75rem",
                  cursor: "pointer",
                }}
              >
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about page ${currentPage}…`}
          disabled={streaming}
          aria-label="Ask a question"
          style={{
            flex: 1,
            background: "var(--surface, #1e293b)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.9rem",
          }}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send question"
          style={{
            background: "var(--accent, #2563eb)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
            opacity: streaming || !input.trim() ? 0.5 : 1,
          }}
        >
          {streaming ? "…" : "Ask"}
        </button>
      </form>
    </aside>
  );
}
