"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/client";
import { plainText } from "@/lib/text";
import { TYPE_META } from "@/lib/theme";
import type { Card } from "@/lib/types";
import { cardHelpers, formatDate, today, useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";

const DAY = 86400_000;
const toMs = (d: string) => new Date(d + "T00:00:00").getTime();

export function Storyline({ visible }: { visible: (c: Card) => boolean }) {
  const { data, mutate, perms } = useBoard();
  const [newEpic, setNewEpic] = useState("");
  const epics = data.cards
    .filter((c) => c.type === "epic")
    .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999") || a.created_at - b.created_at);
  const orphans = data.cards.filter((c) => c.type !== "epic" && !c.parent_id && visible(c));

  async function addEpic() {
    if (!newEpic.trim()) return;
    const title = newEpic;
    setNewEpic("");
    await mutate(() => api(`/api/boards/${data.board.id}/cards`, "POST", { title, type: "epic" }));
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Timeline epics={epics} />

        {perms.createCard && <div className="flex gap-2 rounded-xl bg-surface/95 p-3 shadow-sm">
          <label className="relative flex flex-1 items-center">
            <Icon name="epic" className="pointer-events-none absolute left-3 h-4 w-4 text-violet-600 dark:text-violet-300" />
            <input className="w-full rounded-md border py-2 pr-3 pl-9 text-sm" placeholder="Nama epic baru, mis. 'Checkout & Pembayaran'" value={newEpic} onChange={(e) => setNewEpic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEpic()} />
          </label>
          <button onClick={addEpic} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 dark:hover:bg-violet-500">+ Epic</button>
        </div>}

        {epics.length === 0 && (
          <div className="rounded-xl bg-surface/95 p-6 text-center text-sm text-slate-600 shadow-sm">
            <Icon name="story" className="!block mx-auto mb-2 h-8 w-8 text-violet-500" />
            <b>Storyline</b> membantu kamu menyusun cerita produk: buat <b>Epic</b> (tujuan besar), lalu pecah jadi <b>Story</b> dan <b>Task</b>.
            <br />Progress epic dihitung otomatis dari story yang sudah masuk list &quot;selesai&quot;.
          </div>
        )}

        {epics.map((e, i) => <EpicBlock key={e.id} epic={e} index={i + 1} visible={visible} />)}

        {orphans.length > 0 && (
          <section className="rounded-xl bg-surface/95 p-4 shadow-sm">
            <h3 className="mb-2 font-semibold text-slate-700">Belum masuk epic <span className="font-normal text-slate-400">({orphans.length})</span></h3>
            <div className="divide-y">{orphans.map((c) => <StoryRow key={c.id} card={c} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}

function EpicBlock({ epic, index, visible }: { epic: Card; index: number; visible: (c: Card) => boolean }) {
  const { data, mutate, openCard, perms } = useBoard();
  const { childrenOf, progress, isDone } = cardHelpers(data);
  const [adding, setAdding] = useState("");
  const [open, setOpen] = useState(true);
  const kids = childrenOf(epic.id).filter(visible);
  const p = progress(epic.id);
  const color = epic.color ?? "#8b5cf6";

  async function addStory() {
    if (!adding.trim()) return;
    const title = adding;
    setAdding("");
    await mutate(() => api(`/api/boards/${data.board.id}/cards`, "POST", { title, type: "story", parentId: epic.id }));
  }

  return (
    <section className="overflow-hidden rounded-xl bg-surface shadow-sm">
      <div className="flex items-center gap-3 p-4" style={{ borderLeft: `6px solid ${color}` }}>
        <button onClick={() => setOpen(!open)} aria-label={open ? "Tutup" : "Buka"} className="text-slate-400"><Icon name={open ? "chevron-down" : "chevron-right"} /></button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-white" style={{ background: color }}>{index}</div>
        <button onClick={() => openCard(epic.id)} className="min-w-0 flex-1 text-left">
          <div className={`truncate font-semibold ${isDone(epic) ? "line-through opacity-60" : ""}`}>{epic.title}</div>
          <div className="text-xs text-slate-500">
            {epic.start_date || epic.due_date ? `${formatDate(epic.start_date) || "?"} → ${formatDate(epic.due_date) || "?"}` : "Belum ada jadwal"}
            {" · "}{data.lists.find((l) => l.id === epic.list_id)?.name}
          </div>
        </button>
        <div className="hidden w-40 sm:block">
          <div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full" style={{ width: `${p.pct}%`, background: color }} /></div>
          <div className="mt-0.5 text-right text-xs text-slate-500">{p.done}/{p.total} · {p.pct}%</div>
        </div>
      </div>
      {open && (
        <div className="border-t px-4 py-2 sm:pl-16">
          {epic.description && <p className="mb-2 line-clamp-2 text-sm text-slate-600">{plainText(epic.description)}</p>}
          <div className="divide-y">{kids.map((c) => <StoryRow key={c.id} card={c} />)}</div>
          {perms.createCard && <input className="my-2 w-full rounded-md border border-dashed px-3 py-1.5 text-sm" placeholder="+ Tambah story ke epic ini (Enter)" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStory()} />}
        </div>
      )}
    </section>
  );
}

function StoryRow({ card }: { card: Card }) {
  const { data, openCard, isOnline } = useBoard();
  const { isDone } = cardHelpers(data);
  const t = TYPE_META[card.type];
  const list = data.lists.find((l) => l.id === card.list_id);
  const people = data.members.filter((m) => card.assignees.includes(m.id));
  const done = isDone(card);
  return (
    <button onClick={() => openCard(card.id)} className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50">
      <span style={{ color: t.color }} title={t.label}><Icon name={t.icon} /></span>
      <span className={`min-w-0 flex-1 truncate ${done ? "text-slate-400 line-through" : ""}`}>{card.title}</span>
      {card.due_date && <span className={`text-xs ${!done && card.due_date < today() ? "text-red-600" : "text-slate-500"}`}>{formatDate(card.due_date)}</span>}
      <span className="flex -space-x-1.5">{people.map((m) => <Avatar key={m.id} name={m.name} color={m.color} src={m.avatar} size={20} ring online={isOnline(m.id)} />)}</span>
      <span className={`rounded px-1.5 py-0.5 text-xs ${done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{list?.name}</span>
    </button>
  );
}

// simple gantt of epics that have dates
function Timeline({ epics }: { epics: Card[] }) {
  const { data, openCard } = useBoard();
  const { progress } = cardHelpers(data);
  const dated = epics.filter((e) => e.start_date || e.due_date);
  if (dated.length === 0) return null;

  const starts = dated.map((e) => toMs(e.start_date ?? e.due_date!));
  const ends = dated.map((e) => toMs(e.due_date ?? e.start_date!));
  const min = new Date(Math.min(...starts, Date.now()));
  const max = new Date(Math.max(...ends, Date.now()));
  const from = new Date(min.getFullYear(), min.getMonth(), 1).getTime();
  const to = new Date(max.getFullYear(), max.getMonth() + 1, 1).getTime();
  const span = to - from;
  const pct = (ms: number) => ((ms - from) / span) * 100;

  const months: { label: string; left: number }[] = [];
  for (let d = new Date(from); d.getTime() < to; d.setMonth(d.getMonth() + 1))
    months.push({ label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }), left: pct(d.getTime()) });

  return (
    <section className="rounded-xl bg-surface p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700"><Icon name="calendar" className="h-4 w-4 text-slate-500" />Timeline epic</h3>
      <div className="relative">
        <div className="relative mb-1 h-5 text-[11px] text-slate-500">
          {months.map((m) => <span key={m.left} className="absolute" style={{ left: `${m.left}%` }}>{m.label}</span>)}
        </div>
        <div className="relative space-y-1.5">
          {months.map((m) => <div key={m.left} className="absolute top-0 bottom-0 border-l border-slate-100" style={{ left: `${m.left}%` }} />)}
          <div className="absolute top-0 bottom-0 z-10 border-l-2 border-red-400" style={{ left: `${pct(Date.now())}%` }} title="Hari ini" />
          {dated.map((e) => {
            const s = toMs(e.start_date ?? e.due_date!);
            const en = toMs(e.due_date ?? e.start_date!) + DAY;
            const p = progress(e.id);
            const color = e.color ?? "#8b5cf6";
            return (
              <button key={e.id} onClick={() => openCard(e.id)} className="relative block h-7 w-full">
                <span className="absolute top-0 flex h-7 items-center overflow-hidden rounded-md text-xs font-medium whitespace-nowrap text-white shadow-sm" style={{ left: `${pct(s)}%`, width: `max(${pct(en) - pct(s)}%, 24px)`, background: color + "66" }}>
                  <span className="absolute inset-y-0 left-0" style={{ width: `${p.pct}%`, background: color }} />
                  <span className="relative px-2 drop-shadow">{e.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
