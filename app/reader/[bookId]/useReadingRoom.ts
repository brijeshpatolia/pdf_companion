"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "../../../src/adapters/supabase/browserClient.js";
import {
  participantsFrom,
  parseLiveHighlight,
  parsePosition,
  withLivePages,
  addHighlight,
} from "../../../src/core/rooms/messages.js";
import type { Participant, LiveHighlight } from "../../../src/core/rooms/types.js";

/**
 * Joins a co-reading room over a Supabase Realtime channel.
 *
 * Two primitives, each doing the job it's actually built for:
 *
 * - **Presence** answers *who is here*. It changes on join and leave, and it
 *   carries the page a reader arrived on so a latecomer isn't staring at
 *   blanks until someone turns a page.
 * - **Broadcast** answers *where they are now*, and *what they just
 *   highlighted*. Position is a stream of events, not a membership fact.
 *
 * That split is the fix for a bug worth remembering: position originally rode
 * on presence via repeated `track()` calls, and against live Realtime only the
 * *first* update ever reached the other clients — every later page turn was
 * silently dropped, so the room showed a stale page until someone reloaded.
 * The same test over broadcast delivered five of five.
 *
 * Nothing here is persisted. When the last participant leaves, the room's
 * state is simply gone.
 */

interface Options {
  /** Null when this reader isn't in a room; the hook stays dormant. */
  token: string | null;
  userId: string | null;
  name: string;
  /** The page this reader is on, broadcast to the others. */
  page: number;
  /** Called when the followed reader turns a page. */
  onFollow?: (page: number) => void;
}

export interface ReadingRoomState {
  connected: boolean;
  participants: Participant[];
  liveHighlights: LiveHighlight[];
  /** userId of the reader being followed, or null. */
  following: string | null;
  setFollowing: (userId: string | null) => void;
  /** Announce a highlight to the room. No-op when not connected. */
  shareHighlight: (text: string, page: number) => void;
}

export function useReadingRoom({
  token,
  userId,
  name,
  page,
  onFollow,
}: Options): ReadingRoomState {
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<Participant[]>([]);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [liveHighlights, setLiveHighlights] = useState<LiveHighlight[]>([]);
  const [following, setFollowing] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Read the latest values inside long-lived callbacks without re-subscribing —
  // resubscribing would drop this reader out of the room and back in.
  const pageRef = useRef(page);
  pageRef.current = page;
  const nameRef = useRef(name);
  nameRef.current = name;
  const followingRef = useRef(following);
  followingRef.current = following;
  const onFollowRef = useRef(onFollow);
  onFollowRef.current = onFollow;

  useEffect(() => {
    if (!token || !userId) {
      setConnected(false);
      setMembers([]);
      setPositions({});
      return;
    }

    const supabase = supabaseBrowser();
    const selfKey = `${userId}:${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase.channel(`room:${token}`, {
      config: { presence: { key: selfKey } },
    });
    channelRef.current = channel;

    const announce = () => {
      void channel.send({
        type: "broadcast",
        event: "position",
        payload: { userId, page: pageRef.current },
      });
    };

    const syncPresence = () => {
      setMembers(participantsFrom(channel.presenceState() as Record<string, unknown[]>, selfKey));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, () => {
        syncPresence();
        // Someone just arrived and missed every position broadcast so far.
        // Re-announce so they see where we are without waiting for a turn.
        announce();
      })
      .on("presence", { event: "leave" }, syncPresence)
      .on("broadcast", { event: "position" }, ({ payload }) => {
        const pos = parsePosition(payload); // from another browser — untrusted
        if (!pos || pos.userId === userId) return;
        setPositions((prev) =>
          prev[pos.userId] === pos.page ? prev : { ...prev, [pos.userId]: pos.page },
        );
        if (followingRef.current === pos.userId) onFollowRef.current?.(pos.page);
      })
      .on("broadcast", { event: "highlight" }, ({ payload }) => {
        const highlight = parseLiveHighlight(payload, Date.now());
        if (!highlight || highlight.userId === userId) return;
        setLiveHighlights((feed) => addHighlight(feed, highlight));
      })
      .subscribe((status) => {
        const live = status === "SUBSCRIBED";
        setConnected(live);
        if (live) void channel.track({ userId, name: nameRef.current, page: pageRef.current });
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [token, userId]);

  // Every page turn goes out as a broadcast — the one delivery path that
  // reliably reaches the room.
  useEffect(() => {
    if (!connected || !userId || !channelRef.current) return;
    void channelRef.current.send({
      type: "broadcast",
      event: "position",
      payload: { userId, page },
    });
  }, [connected, userId, page]);

  // Stop following someone who left, or the chip would linger with no one behind it.
  useEffect(() => {
    if (following && !members.some((m) => m.userId === following)) setFollowing(null);
  }, [following, members]);

  const participants = useMemo(() => withLivePages(members, positions), [members, positions]);

  const shareHighlight = useCallback(
    (text: string, highlightPage: number) => {
      const channel = channelRef.current;
      if (!channel || !connected || !userId) return;
      void channel.send({
        type: "broadcast",
        event: "highlight",
        payload: {
          id: `${userId}-${Date.now()}`,
          userId,
          name: nameRef.current,
          page: highlightPage,
          text,
        },
      });
    },
    [connected, userId],
  );

  return useMemo(
    () => ({ connected, participants, liveHighlights, following, setFollowing, shareHighlight }),
    [connected, participants, liveHighlights, following, shareHighlight],
  );
}
