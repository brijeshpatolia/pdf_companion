"use client";

import { useEffect, useState } from "react";
import type { Participant, LiveHighlight } from "../../../src/core/rooms/types.js";

/**
 * The co-reading strip: open or close a room, see who else is here and what
 * page they're on, and jump to them. Renders nothing but a button until the
 * reader actually starts or joins a room.
 */

interface Props {
  bookId: string;
  /** Non-null once this reader is in a room. */
  token: string | null;
  onTokenChange: (token: string | null) => void;
  connected: boolean;
  participants: Participant[];
  liveHighlights: LiveHighlight[];
  onJumpToPage: (page: number) => void;
  /** True when this reader followed someone else's link. */
  isGuest: boolean;
}

const dot = (color: string) => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

export default function RoomBar({
  bookId,
  token,
  onTokenChange,
  connected,
  participants,
  liveHighlights,
  onJumpToPage,
  isGuest,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up a room the host already opened on this book.
  useEffect(() => {
    if (isGuest) return;
    fetch(`/api/rooms?bookId=${bookId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.open && d.token) onTokenChange(d.token);
      })
      .catch(() => {});
  }, [bookId, isGuest, onTokenChange]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `couldn't open the room (${res.status})`);
      onTokenChange(data.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/rooms?bookId=${bookId}`, { method: "DELETE" });
      onTokenChange(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!token) return;
    const link = `${window.location.origin}/room/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError(link); // clipboard blocked — show it so it can be copied by hand
    }
  }

  if (!token) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button className="btn-ghost btn-sm" onClick={open} disabled={busy}>
          {busy ? "Opening…" : "👥 Read together"}
        </button>
        {error && (
          <span role="alert" style={{ color: "var(--danger)", fontSize: "0.78rem" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  const others = participants.filter((p) => !p.isSelf);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span
          style={dot(connected ? "var(--ok)" : "var(--warn)")}
          aria-hidden="true"
        />
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {connected ? "Reading together" : "Connecting…"}
        </span>

        {others.length === 0 && connected && (
          <span style={{ fontSize: "0.78rem", color: "var(--faint)" }}>
            {isGuest ? "waiting for others" : "share the link to invite someone"}
          </span>
        )}

        {others.map((p) => (
          <button
            key={p.key}
            className="btn-ghost btn-sm"
            onClick={() => onJumpToPage(p.page)}
            title={`Jump to ${p.name}'s page`}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <span style={dot("var(--accent)")} aria-hidden="true" />
            {p.name} <span style={{ color: "var(--faint)" }}>p.{p.page}</span>
          </button>
        ))}

        {!isGuest && (
          <>
            <button className="btn-ghost btn-sm" onClick={copyLink}>
              {copied ? "Link copied ✓" : "Copy invite link"}
            </button>
            <button className="btn-danger btn-sm" onClick={close} disabled={busy}>
              End
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: "0.78rem", margin: 0 }}>
          {error}
        </p>
      )}

      {liveHighlights.length > 0 && (
        <ul
          aria-label="Highlights from the room"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          {liveHighlights.slice(0, 3).map((h) => (
            <li key={h.id} className="fade-in" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              <button
                className="btn-ghost btn-sm"
                onClick={() => onJumpToPage(h.page)}
                style={{ textAlign: "left", whiteSpace: "normal" }}
              >
                <strong style={{ color: "var(--text)" }}>{h.name}</strong> highlighted p.{h.page}:{" "}
                <span style={{ fontStyle: "italic" }}>
                  “{h.text.length > 140 ? `${h.text.slice(0, 140)}…` : h.text}”
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
