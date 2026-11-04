"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { boardBg } from "@/lib/theme";
import { PopoverPanel, usePopover } from "./ui/Popover";

type Row = { id: string; name: string; color: string; role: string; card_count: number };

// github-style "owner / repo ▾" picker: jump to another board from the top bar
export function BoardSwitcher({ current }: { current: { id: string; name: string; color: string } }) {
  const router = useRouter();
  const pop = usePopover({ placement: "bottom-start" });
  const [boards, setBoards] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);

  // load boards each time the menu opens so new boards show up
  useEffect(() => {
    if (!pop.open) return;
    setQ("");
    setHi(0);
    api<Row[]>("/api/boards").then(setBoards).catch(() => setBoards([]));
  }, [pop.open]);

  const shown = (boards ?? []).filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));

  function go(id: string) {
    pop.setOpen(false);
    if (id !== current.id) router.push(`/b/${id}`);
  }

  // arrow keys move the highlight, enter opens it
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && shown[hi]) go(shown[hi].id);
    else if (e.key === "Escape") pop.setOpen(false);
  }

  return (
    <>
      <span className="text-white/40">/</span>
      <button
        data-tour="board-switcher"
        ref={pop.refs.setReference}
        onClick={() => pop.setOpen(!pop.open)}
        data-open={pop.open}
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold transition hover:bg-white/20 data-[open=true]:bg-white/25"
      >
        <span className="h-4 w-4 shrink-0 rounded ring-1 ring-white/40" style={{ background: boardBg(current.color) }} />
        <span className="max-w-40 truncate sm:max-w-64">{current.name}</span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 opacity-70" fill="currentColor"><path d="M5.5 8 10 12.5 14.5 8z" /></svg>
      </button>
      <PopoverPanel pop={pop} className="w-72" onKeyDown={onKey}>
        <div className="border-b border-slate-100 p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setHi(0))}
            placeholder="Cari board…"
            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="scroll-thin overflow-y-auto p-1">
          {boards === null && <div className="p-3 text-center text-sm text-slate-400">Memuat…</div>}
          {boards && !shown.length && <div className="p-3 text-center text-sm text-slate-400">Board tidak ditemukan</div>}
          {shown.map((b, i) => (
            <button
              key={b.id}
              onClick={() => go(b.id)}
              onMouseEnter={() => setHi(i)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm ${i === hi ? "bg-slate-100" : ""}`}
            >
              <span className="h-5 w-5 shrink-0 rounded" style={{ background: boardBg(b.color) }} />
              <span className={`min-w-0 flex-1 truncate ${b.id === current.id ? "font-semibold" : ""}`}>{b.name}</span>
              {b.id === current.id ? <span className="text-xs text-blue-600">✓</span> : <span className="text-[11px] text-slate-400">{b.card_count} kartu</span>}
            </button>
          ))}
        </div>
        <Link href="/boards" onClick={() => pop.setOpen(false)} className="block border-t border-slate-100 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50">Lihat semua board →</Link>
      </PopoverPanel>
    </>
  );
}
