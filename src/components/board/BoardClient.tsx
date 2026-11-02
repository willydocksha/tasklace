"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/TopBar";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { realtimeEnabled, useBoardChannel } from "@/lib/realtime";
import { boardBg, TYPE_META } from "@/lib/theme";
import type { BoardData, Card } from "@/lib/types";
import { CardModal } from "./CardModal";
import { Ctx } from "./context";
import { Kanban } from "./Kanban";
import { Settings } from "./Settings";
import { Storyline } from "./Storyline";

type View = "board" | "storyline";
// realtime pushes changes; polling is only a fallback
const POLL_MS = realtimeEnabled ? 60_000 : 4000;

export function BoardClient({ user, initial }: { user: User; initial: BoardData }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>("board");
  const [openId, setOpenId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fMember, setFMember] = useState("");
  const dragging = useRef(false);

  const refresh = useCallback(async () => {
    setData(await api<BoardData>(`/api/boards/${initial.board.id}`));
  }, [initial.board.id]);

  // reload when another member changes the board (skipped mid-drag)
  const ping = useBoardChannel(initial.board.id, () => {
    if (!dragging.current) refresh().catch(() => {});
  });

  const mutate = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        ping();
      } catch (e) {
        alert((e as Error).message);
      }
      await refresh().catch(() => {});
    },
    [refresh, ping],
  );

  // poll as a safety net and catch up when the tab regains focus
  useEffect(() => {
    const tick = () => {
      if (!dragging.current && document.visibilityState === "visible") refresh().catch(() => {});
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // remember the chosen view per board
  useEffect(() => {
    try {
      const v = localStorage.getItem(`tb-view-${initial.board.id}`);
      if (v === "board" || v === "storyline") setView(v);
    } catch {}
  }, [initial.board.id]);
  const switchView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(`tb-view-${initial.board.id}`, v);
    } catch {}
  };

  const visible = (c: Card) =>
    (!q || c.title.toLowerCase().includes(q.toLowerCase())) && (!fType || c.type === fType) && (!fMember || c.assignees.includes(fMember));
  const openCard = data.cards.find((c) => c.id === openId);
  const isAdmin = data.role !== "member";
  const filtering = !!(q || fType || fMember);

  return (
    <Ctx.Provider value={{ data, user, refresh, mutate, openCard: setOpenId, isAdmin }}>
      <div className="flex h-screen flex-col" style={{ background: boardBg(data.board.color) }}>
        <TopBar user={user} dark />
        <div className="flex flex-wrap items-center gap-2 bg-black/15 px-3 py-2 text-white sm:px-4">
          <h1 className="mr-2 text-lg font-bold drop-shadow">{data.board.name}</h1>
          <div className="flex rounded-lg bg-black/20 p-0.5 text-sm">
            {(["board", "storyline"] as View[]).map((v) => (
              <button key={v} onClick={() => switchView(v)} className={`rounded-md px-3 py-1 ${view === v ? "bg-white font-medium text-slate-800" : "hover:bg-white/15"}`}>
                {v === "board" ? "▦ Board" : "📚 Storyline"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari kartu" className="w-36 rounded-md bg-white/20 px-2 py-1 placeholder-white/70 outline-none focus:bg-white focus:text-slate-800 focus:placeholder-slate-400" />
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="rounded-md bg-white/20 px-1.5 py-1 [&>option]:text-slate-800">
              <option value="">Semua tipe</option>
              {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <select value={fMember} onChange={(e) => setFMember(e.target.value)} className="rounded-md bg-white/20 px-1.5 py-1 [&>option]:text-slate-800">
              <option value="">Semua member</option>
              <option value={user.id}>Tugas saya</option>
              {data.members.filter((m) => m.id !== user.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {filtering && <button onClick={() => (setQ(""), setFType(""), setFMember(""))} className="rounded-md px-2 py-1 hover:bg-white/20">Reset</button>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setSettings(true)} className="flex -space-x-2" title="Member">
              {data.members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} color={m.color} size={28} ring />)}
              {data.members.length > 5 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/30 text-xs ring-2 ring-white">+{data.members.length - 5}</span>}
            </button>
            <button onClick={() => setSettings(true)} className="rounded-md bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-100">
              Bagikan / Atur
            </button>
          </div>
        </div>
        {filtering && view === "board" && <div className="bg-amber-100 px-4 py-1 text-xs text-amber-800">Filter aktif, drag &amp; drop dimatikan sementara.</div>}
        <div className="min-h-0 flex-1">{view === "board" ? <Kanban visible={visible} draggingRef={dragging} /> : <Storyline visible={visible} />}</div>
      </div>
      {openCard && <CardModal card={openCard} onClose={() => setOpenId(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </Ctx.Provider>
  );
}
