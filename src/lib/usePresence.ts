"use client";
import { useEffect, useState } from "react";
import { PRESENCE_PING_MS } from "./presence";

// online ids plus each member's last seen time (unix ms)
export type Presence = { online: Set<string>; seen: Record<string, number> };
// one member's status for the avatar; undefined when presence is off
export type Status = { online: boolean; seen: number | null };

export const statusOf = (p: Presence | null, id: string): Status | undefined =>
  p ? { online: p.online.has(id), seen: p.seen[id] ?? null } : undefined;

// pings the presence route while the tab is visible; returns who is online on the
// board or team, or null when the feature is off (or before the first answer)
export function usePresence(scope: { boardId: string } | { teamId: string }) {
  // stable key so the effect only restarts when the board/team changes
  const key = JSON.stringify(scope);
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    let stopped = false;

    // one heartbeat; turns itself off when the server says the feature is disabled
    const ping = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: key });
        if (!res.ok) return;
        const json = (await res.json()) as { enabled: boolean; online?: string[]; seen?: Record<string, number> };
        if (!json.enabled) {
          stopped = true;
          clearInterval(timer);
          setPresence(null);
          return;
        }
        if (!stopped) setPresence({ online: new Set(json.online), seen: json.seen ?? {} });
      } catch {}
    };

    // ping now, on an interval, and right away when the tab comes back
    const timer = setInterval(ping, PRESENCE_PING_MS);
    void ping();
    const onVisible = () => void ping();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key]);

  return presence;
}
