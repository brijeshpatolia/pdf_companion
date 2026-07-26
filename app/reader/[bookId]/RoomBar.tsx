"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import type { Participant, LiveHighlight } from "../../../src/core/rooms/types.js";

/**
 * The co-reading strip: who's here, where they are, and what they just marked.
 *
 * Until a room is open this is a single button — co-reading shouldn't cost
 * screen space to people reading alone.
 */

interface Props {
  bookId: string;
  token: string | null;
  onTokenChange: (token: string | null) => void;
  connected: boolean;
  participants: Participant[];
  liveHighlights: LiveHighlight[];
  following: string | null;
  onFollowChange: (userId: string | null) => void;
  onJumpToPage: (page: number) => void;
  isGuest: boolean;
}

/** Stable hue per reader, so the same person keeps a colour without us storing one. */
function hue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % 360;
  return h;
}

function Avatar({ name, userId, small }: { name: string; userId: string; small?: boolean }) {
  return (
    <span
      className={`avatar${small ? " avatar-sm" : ""}`}
      style={{ ["--avatar-h" as string]: hue(userId) }}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** Marks the chip for one animation frame each time the page actually changes. */
function useMoved(page: number): boolean {
  const [moved, setMoved] = useState(false);
  const prev = useRef(page);
  useEffect(() => {
    if (prev.current === page) return;
    prev.current = page;
    setMoved(true);
    const id = setTimeout(() => setMoved(false), 400);
    return () => clearTimeout(id);
  }, [page]);
  return moved;
}

function PeerChip({
  peer,
  following,
  onToggleFollow,
}: {
  peer: Participant;
  following: boolean;
  onToggleFollow: () => void;
}) {
  const moved = useMoved(peer.page);
  return (
    <button
      className="peer-chip"
      data-following={following}
      data-moved={moved}
      onClick={onToggleFollow}
      title={following ? `Stop following ${peer.name}` : `Follow ${peer.name} as they read`}
    >
      <Avatar name={peer.name} userId={peer.userId} />
      {peer.name}
      <span className="peer-page">p.{peer.page}</span>
      {following && <Icon name="eye" size="0.85em" />}
    </button>
  );
}

export default function RoomBar({
  bookId,
  token,
  onTokenChange,
  connected,
  participants,
  liveHighlights,
  following,
  onFollowChange,
  onJumpToPage,
  isGuest,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);

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
      onFollowChange(null);
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
      // Clipboard is blocked outside a secure context — show it to copy by hand.
      setManualLink(link);
    }
  }

  if (!token) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button className="btn-ghost btn-sm" onClick={open} disabled={busy}>
          <Icon name="users" />
          {busy ? "Opening…" : "Read together"}
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
    <div className="rise-in" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className="live-dot" data-state={connected ? "live" : "connecting"} aria-hidden="true" />
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {connected ? "Reading together" : "Connecting…"}
        </span>

        {connected && others.length === 0 && (
          <span style={{ fontSize: "0.78rem", color: "var(--faint)" }}>
            {isGuest ? "waiting for others" : "share the link to invite someone"}
          </span>
        )}

        {others.map((p) => (
          <PeerChip
            key={p.key}
            peer={p}
            following={following === p.userId}
            onToggleFollow={() => {
              const next = following === p.userId ? null : p.userId;
              onFollowChange(next);
              // Following starts by catching up to where they already are.
              if (next) onJumpToPage(p.page);
            }}
          />
        ))}

        <span style={{ flex: 1 }} />

        {!isGuest && (
          <>
            <button className="btn-ghost btn-sm" onClick={copyLink}>
              <Icon name={copied ? "check" : "link"} />
              {copied ? "Link copied" : "Invite"}
            </button>
            <button className="btn-danger btn-sm" onClick={close} disabled={busy}>
              End
            </button>
          </>
        )}
      </div>

      {following && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--accent)" }}>
          <Icon name="eye" /> Following {others.find((p) => p.userId === following)?.name ?? "a reader"} — your
          page turns with theirs.
        </p>
      )}

      {manualLink && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", wordBreak: "break-all" }}>
          Copy this link: <code>{manualLink}</code>
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: "0.78rem", margin: 0 }}>
          {error}
        </p>
      )}

      {liveHighlights.length > 0 && (
        <ul
          aria-label="Highlights from the room"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.2rem" }}
        >
          {liveHighlights.slice(0, 3).map((h) => (
            <li key={h.id} className="rise-in">
              <button
                className="btn-ghost btn-sm"
                onClick={() => onJumpToPage(h.page)}
                style={{
                  textAlign: "left",
                  whiteSpace: "normal",
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  justifyContent: "flex-start",
                  width: "100%",
                }}
              >
                <Avatar name={h.name} userId={h.userId} small />
                <span>
                  <strong style={{ color: "var(--text)" }}>{h.name}</strong> marked p.{h.page} ·{" "}
                  <span style={{ fontStyle: "italic" }}>
                    “{h.text.length > 120 ? `${h.text.slice(0, 120)}…` : h.text}”
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
