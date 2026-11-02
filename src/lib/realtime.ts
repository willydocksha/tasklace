"use client";
import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
import { useCallback, useEffect, useRef } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// true when supabase realtime is configured
export const realtimeEnabled = !!(URL && KEY);

let client: RealtimeClient | null = null;

// one shared socket per tab
function getClient() {
  if (!client) client = new RealtimeClient(`${URL!.replace(/^http/, "ws")}/realtime/v1`, { params: { apikey: KEY! } });
  return client;
}

// subscribes to a board's channel; returns a ping fn that tells other viewers to reload.
// only a "changed" signal is sent, never board data, so the channel leaks nothing.
export function useBoardChannel(boardId: string, onChange: () => void) {
  const channel = useRef<RealtimeChannel | null>(null);
  const handler = useRef(onChange);
  handler.current = onChange;

  // join the channel while the board is open
  useEffect(() => {
    if (!realtimeEnabled) return;
    const ch = getClient()
      .channel(`board:${boardId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "changed" }, () => handler.current())
      .subscribe();
    channel.current = ch;
    return () => {
      channel.current = null;
      void getClient().removeChannel(ch);
    };
  }, [boardId]);

  // notify everyone else on this board
  return useCallback(() => {
    void channel.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }, []);
}
