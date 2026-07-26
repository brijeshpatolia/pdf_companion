"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "../../../src/adapters/supabase/browserClient.js";
import {
  participantsFrom,
  parseLiveHighlight,
  addHighlight,
} from "../../../src/core/rooms/messages.js";
import type { Participant, LiveHighlight } from "../../../src/core/rooms/types.js";

/**
 * Joins a co-reading room over a Supabase Realtime channel.
 *
 * Nothing here is persisted. Presence carries who's in the room and what page
 * they're on; a broadcast carries a highlight the moment someone makes one.
 * When the last participant leaves, the room's state is simply gone — which is
 * the right model for "we read this together on Tuesday" and means no one's
 * annotations ever land in someone else's account.
 */

interface Options {
  /** Null when this reader isn't in a room; the hook stays dormant. */
  token: string | null;
  userId: string | null;
  name: string;
  /** The page this reader is on, broadcast to the others. */
  page: number;
}

export interface ReadingRoomState {
  connected: boolean;
  participants: Participant[];
  liveHighlights: LiveHighlight[];
  /** Announce a highlight to the room. No-op when not connected. */
  shareHighlight: (text: string, page: number) => void;
}

export function useReadingRoom({ token, userId, name, page }: Options): ReadingRoomState {
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [liveHighlights, setLiveHighlights] = useState<LiveHighlight[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Read the latest page inside callbacks without re-subscribing on every turn
  // of the page — resubscribing would drop everyone's presence.
  const pageRef = useRef(page);
  pageRef.current = page;
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (!token || !userId) {
      setConnected(false);
      setParticipants([]);
      return;
    }

    const supabase = supabaseBrowser();
    const channel = supabase.channel(`room:${token}`, {
      config: { presence: { key: `${userId}:${Math.random().toString(36).slice(2, 10)}` } },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      // The presence key we asked for is the one we're stored under.
      const selfKey = Object.keys(state).find((k) => k.startsWith(`${userId}:`)) ?? "";
      setParticipants(participantsFrom(state, selfKey));
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .on("broadcast", { event: "highlight" }, ({ payload }) => {
        // Payload comes from another participant's browser — untrusted.
        const highlight = parseLiveHighlight(payload, Date.now());
        if (!highlight) return;
        setLiveHighlights((feed) => addHighlight(feed, highlight));
      })
      .subscribe((status) => {
        const live = status === "SUBSCRIBED";
        setConnected(live);
        if (live) {
          void channel.track({ userId, name: nameRef.current, page: pageRef.current });
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [token, userId]);

  // Tell the room when this reader turns the page.
  useEffect(() => {
    if (!connected || !userId || !channelRef.current) return;
    void channelRef.current.track({ userId, name: nameRef.current, page });
  }, [connected, userId, page]);

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
    () => ({ connected, participants, liveHighlights, shareHighlight }),
    [connected, participants, liveHighlights, shareHighlight],
  );
}
