"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Note {
  id: string;
  bookId: string;
  page: number | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesProps {
  bookId: string;
  currentPage: number;
  onJumpToPage?: (page: number) => void;
  onCountChange?: (n: number) => void;
}

export default function Notes({ bookId, currentPage, onJumpToPage, onCountChange }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const countCb = useRef(onCountChange);
  countCb.current = onCountChange;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?bookId=${bookId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotes(data);
          countCb.current?.(data.length);
        }
      }
    } catch {}
  }, [bookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add() {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, page: currentPage, text }),
      });
      if (res.ok) {
        setDraft("");
        await refresh();
      }
    } catch {} finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    try {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text }),
      });
      setEditingId(null);
      await refresh();
    } catch {}
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      await refresh();
    } catch {}
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <textarea
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Write a note about page ${currentPage}…`}
          rows={3}
          aria-label="Write a note"
          style={{ width: "100%", resize: "vertical", fontSize: "0.88rem", lineHeight: 1.5 }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button className="btn-primary btn-sm" onClick={add} disabled={!draft.trim() || saving}>
            {saving ? "Adding…" : "Add note"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {notes.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem" }}>
            <p style={{ margin: 0, fontSize: "1.3rem" }}>📝</p>
            <p style={{ margin: "0.5rem 0 0" }}>No notes yet — jot down a thought about what you&apos;re reading.</p>
          </div>
        )}

        {notes.map((n) => (
          <div key={n.id} className="card fade-in" style={{ padding: "0.7rem 0.85rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              {n.page != null && (
                <button className="page-chip" onClick={() => onJumpToPage?.(n.page!)} title={`Go to page ${n.page}`}>
                  p. {n.page}
                </button>
              )}
              <span style={{ color: "var(--faint)", fontSize: "0.72rem" }}>
                {new Date(n.updatedAt).toLocaleDateString()}
              </span>
              <span style={{ flex: 1 }} />
              {editingId === n.id ? null : (
                <>
                  <button
                    className="save-btn"
                    onClick={() => {
                      setEditingId(n.id);
                      setEditText(n.text);
                    }}
                    title="Edit"
                    aria-label="Edit note"
                  >
                    ✎
                  </button>
                  <button className="save-btn" onClick={() => remove(n.id)} title="Delete" aria-label="Delete note">
                    ✕
                  </button>
                </>
              )}
            </div>

            {editingId === n.id ? (
              <>
                <textarea
                  className="input"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  aria-label="Edit note"
                  style={{ width: "100%", resize: "vertical", fontSize: "0.88rem", lineHeight: 1.5 }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", marginTop: "0.4rem" }}>
                  <button className="btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => saveEdit(n.id)} disabled={!editText.trim()}>
                    Save
                  </button>
                </div>
              </>
            ) : (
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
