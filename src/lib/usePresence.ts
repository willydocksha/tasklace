"use client";
import { useEffect, useState } from "react";
import { PRESENCE_PING_MS } from "./presence";

// pings the presence route while the tab is visible; returns the ids of online
// board or team members, or null when the feature is off (or before the first answer)
export function usePresence(scope: { boardId: string } | { teamId: string }) {
  // stable key so the effect only restarts when the board/team changes
  const key = JSON.stringify(scope);
  const [online, setOnline] = useState<Set<string> | null>(null);

  useEffect(() => {
    let stopped = false;

    // one heartbeat; turns itself off when the server says the feature is disabled
    const ping = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: key });
        if (!res.ok) return;
        const json = (await res.json()) as { enabled: boolean; online?: string[] };
        if (!json.enabled) {
          stopped = true;
          clearInterval(timer);
          setOnline(null);
          return;
        }
        if (!stopped) setOnline(new Set(json.online));
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

  return online;
}
