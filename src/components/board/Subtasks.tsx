"use client";
import { useState } from "react";
import { confirmDialog } from "@/components/ui/Dialog";
import { api } from "@/lib/client";
import type { Card, Subtask } from "@/lib/types";
import { AssigneePicker } from "./AssigneePicker";
import { NextStatus } from "./NextStatus";
import { subtaskProgress, useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";

// plain-text breakdown of a card (e.g. BE / FE), each with a one-click status
export function Subtasks({ card, locked }: { card: Card; locked: boolean }) {
  const { data, mutate } = useBoard();
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const prog = subtaskProgress(data, card);

  async function add() {
    if (!title.trim()) return;
    const t = title;
    setTitle("");
    await mutate(() => api(`/api/cards/${card.id}/subtasks`, "POST", { title: t }));
  }

  if (locked && !card.subtasks.length) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Subtask{prog.total > 0 && ` · ${prog.done}/${prog.total} selesai`}
        </span>
        {!locked && !adding && (
          <button onClick={() => setAdding(true)} className="ml-auto rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50">+ Tambah subtask</button>
        )}
      </div>
      {prog.total > 0 && (
        <div className="mb-2 h-1.5 overflow-hidden rounded bg-slate-200">
          <div className="h-full rounded bg-green-500 transition-all" style={{ width: `${prog.pct}%` }} />
        </div>
      )}
      {card.subtasks.length > 0 && (
        <div className="divide-y rounded-lg border">
          {card.subtasks.map((s) => <Row key={s.id} sub={s} locked={locked} />)}
        </div>
      )}
      {!card.subtasks.length && !adding && (
        <button onClick={() => setAdding(true)} className="w-full rounded-lg border border-dashed p-2.5 text-left text-sm text-slate-400 hover:border-blue-300 hover:text-blue-600">
          Pecah kartu ini jadi subtask, mis. &quot;API checkout (BE)&quot;, &quot;Halaman checkout (FE)&quot;
        </button>
      )}
      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            className="flex-1 rounded-md border px-2.5 py-1.5 text-sm"
            placeholder="Judul subtask… (Enter untuk tambah)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); if (e.key === "Escape") setAdding(false); }}
          />
          <button onClick={add} className="rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">Tambah</button>
          <button onClick={() => (setAdding(false), setTitle(""))} aria-label="Batal" className="rounded-md px-2 text-slate-500 hover:bg-slate-100"><Icon name="x" /></button>
        </div>
      )}
    </div>
  );
}

// one subtask: inline-editable title, status pill on the right, delete on hover
function Row({ sub, locked }: { sub: Subtask; locked: boolean }) {
  const { data, mutate } = useBoard();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sub.title);
  const listId = sub.list_id ?? [...data.lists].sort((a, b) => a.position - b.position)[0]?.id ?? null;
  const done = !!data.lists.find((l) => l.id === listId)?.is_done;
  const patch = (p: Record<string, unknown>) => mutate(() => api(`/api/subtasks/${sub.id}`, "PATCH", p));

  function save() {
    setEditing(false);
    if (title.trim() && title !== sub.title) void patch({ title });
    else setTitle(sub.title);
  }

  return (
    <div className="group flex items-center gap-2 px-2.5 py-1.5">
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${done ? "border-green-500 bg-green-500 text-white" : "border-slate-300"}`}>{done && <Icon name="check" className="h-3 w-3" />}</span>
      {editing ? (
        <input autoFocus className="flex-1 rounded border-2 border-blue-500 px-1.5 py-0.5 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setTitle(sub.title); setEditing(false); } }} />
      ) : (
        <span onClick={() => !locked && setEditing(true)} className={`min-w-0 flex-1 truncate text-sm ${done ? "text-slate-400 line-through" : ""} ${locked ? "" : "cursor-text"}`}>{sub.title}</span>
      )}
      {!locked && (
        <button title="Hapus subtask" onClick={async () => (await confirmDialog({ title: `Hapus subtask "${sub.title}"?`, danger: true })) && mutate(() => api(`/api/subtasks/${sub.id}`, "DELETE"))} aria-label="Hapus subtask" className="px-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"><Icon name="x" className="h-3.5 w-3.5" /></button>
      )}
      <AssigneePicker variant="compact" value={sub.assignees} disabled={locked} onChange={(ids) => patch({ assignees: ids })} />
      <NextStatus variant="pill" lists={data.lists} current={listId} disabled={locked} onMove={(id) => patch({ list_id: id })} />
    </div>
  );
}
