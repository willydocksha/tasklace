"use client";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { TYPE_META } from "@/lib/theme";
import type { Card, CardType, List } from "@/lib/types";
import { CardView, SortableCard } from "./CardTile";
import { useBoard } from "./context";

type Columns = Record<string, string[]>;

const strip = (id: string) => id.slice(2);

function buildColumns(lists: List[], cards: Card[]): Columns {
  const cols: Columns = Object.fromEntries(lists.map((l) => [l.id, []]));
  for (const c of [...cards].sort((a, b) => a.position - b.position)) cols[c.list_id]?.push(c.id);
  return cols;
}

export function Kanban({ visible, draggingRef }: { visible: (c: Card) => boolean; draggingRef: React.RefObject<boolean> }) {
  const { data, mutate } = useBoard();
  const [listOrder, setListOrder] = useState(() => data.lists.map((l) => l.id));
  const [cols, setCols] = useState(() => buildColumns(data.lists, data.cards));
  const [active, setActive] = useState<string | null>(null);
  const origin = useRef<string | null>(null);
  const filtering = data.cards.some((c) => !visible(c));

  // resync from server data whenever we're not mid-drag
  useEffect(() => {
    if (draggingRef.current) return;
    setListOrder(data.lists.map((l) => l.id));
    setCols(buildColumns(data.lists, data.cards));
  }, [data, draggingRef]);

  // long-press on touch so horizontal scrolling still works on phones
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const cardById = new Map(data.cards.map((c) => [c.id, c]));
  const listById = new Map(data.lists.map((l) => [l.id, l]));

  const containerOf = (id: string, c: Columns = cols) => (id.startsWith("l:") ? strip(id) : Object.keys(c).find((k) => c[k].includes(strip(id))));

  function onStart(e: DragStartEvent) {
    draggingRef.current = true;
    setActive(String(e.active.id));
    origin.current = String(e.active.id).startsWith("c:") ? (containerOf(String(e.active.id)) ?? null) : null;
  }

  // move a card into another column while hovering
  function onOver(e: DragOverEvent) {
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;
    if (!a.startsWith("c:") || !o) return;
    setCols((prev) => {
      const from = containerOf(a, prev);
      const to = containerOf(o, prev);
      if (!from || !to || from === to) return prev;
      const card = strip(a);
      const target = prev[to].filter((x) => x !== card);
      const idx = o.startsWith("c:") ? target.indexOf(strip(o)) : target.length;
      target.splice(idx < 0 ? target.length : idx, 0, card);
      return { ...prev, [from]: prev[from].filter((x) => x !== card), [to]: target };
    });
  }

  function onEnd(e: DragEndEvent) {
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;
    setActive(null);
    const finish = () => {
      draggingRef.current = false;
    };
    if (!o) return finish();

    if (a.startsWith("l:")) {
      const from = listOrder.indexOf(strip(a));
      const to = listOrder.indexOf(containerOf(o) ?? "");
      if (from < 0 || to < 0 || from === to) return finish();
      const next = arrayMove(listOrder, from, to);
      setListOrder(next);
      return void mutate(() => api(`/api/boards/${data.board.id}/order`, "PATCH", { listIds: next })).finally(finish);
    }

    const to = containerOf(o);
    if (!to) return finish();
    let next = cols;
    if (o.startsWith("c:")) {
      const ids = cols[to];
      const fi = ids.indexOf(strip(a));
      const ti = ids.indexOf(strip(o));
      if (fi >= 0 && ti >= 0 && fi !== ti) next = { ...cols, [to]: arrayMove(ids, fi, ti) };
    }
    setCols(next);
    const touched = [...new Set([origin.current, to].filter(Boolean) as string[])];
    void mutate(() => api(`/api/boards/${data.board.id}/order`, "PATCH", { lists: touched.map((l) => ({ listId: l, cardIds: next[l] })) })).finally(finish);
  }

  const activeCard = active?.startsWith("c:") ? cardById.get(strip(active)) : undefined;
  const activeList = active?.startsWith("l:") ? listById.get(strip(active)) : undefined;

  return (
    <DndContext id="kanban" sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => ((draggingRef.current = false), setActive(null))}>
      <div className="scroll-thin flex h-full items-start gap-3 overflow-x-auto p-3 sm:p-4">
        <SortableContext items={listOrder.map((id) => "l:" + id)} strategy={horizontalListSortingStrategy}>
          {listOrder.map((id) => {
            const list = listById.get(id);
            if (!list) return null;
            const cards = (cols[id] ?? []).map((cid) => cardById.get(cid)).filter((c): c is Card => !!c && visible(c));
            return <Column key={id} list={list} cards={cards} dragDisabled={filtering} />;
          })}
        </SortableContext>
        <AddList />
      </div>
      <DragOverlay>
        {activeCard && <CardView card={activeCard} overlay />}
        {activeList && <div className="w-72 rounded-xl bg-slate-100 p-3 font-semibold shadow-xl">{activeList.name}</div>}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ list, cards, dragDisabled }: { list: List; cards: Card[]; dragDisabled: boolean }) {
  const { mutate } = useBoard();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: "l:" + list.id, data: { type: "list" }, disabled: dragDisabled });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [menu, setMenu] = useState(false);

  function rename() {
    setEditing(false);
    if (name.trim() && name !== list.name) void mutate(() => api(`/api/lists/${list.id}`, "PATCH", { name }));
    else setName(list.name);
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-[#f1f2f4] shadow-sm">
      <div className="relative flex items-center gap-2 px-3 pt-2.5 pb-1.5" {...attributes} {...listeners}>
        {editing ? (
          <input autoFocus className="w-full rounded border-2 border-blue-500 px-1.5 py-0.5 text-sm font-semibold" value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Enter" && rename()} onPointerDown={(e) => e.stopPropagation()} />
        ) : (
          <h3 className="flex-1 cursor-grab text-sm font-semibold" onClick={() => setEditing(true)}>
            {list.name}
            {list.is_done ? <span className="ml-1.5 rounded bg-green-100 px-1 text-[10px] font-medium text-green-700">DONE</span> : null}
          </h3>
        )}
        <span className="text-xs text-slate-500">{cards.length}</span>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenu(!menu)} className="rounded px-1.5 text-slate-500 hover:bg-slate-300">
          ⋯
        </button>
        {menu && (
          <div className="absolute top-9 right-2 z-20 w-56 rounded-lg bg-white py-1 text-sm shadow-xl ring-1 ring-slate-200" onPointerDown={(e) => e.stopPropagation()}>
            <button className="block w-full px-3 py-2 text-left hover:bg-slate-100" onClick={() => (setMenu(false), mutate(() => api(`/api/lists/${list.id}`, "PATCH", { is_done: !list.is_done })))}>
              {list.is_done ? "Hapus tanda 'selesai'" : "Tandai sebagai list selesai ✅"}
            </button>
            <button className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50" onClick={() => { setMenu(false); if (confirm(`Hapus list "${list.name}" beserta semua kartunya?`)) void mutate(() => api(`/api/lists/${list.id}`, "DELETE")); }}>
              Hapus list
            </button>
          </div>
        )}
      </div>
      <div className="scroll-thin flex min-h-2 flex-col gap-2 overflow-y-auto px-2 pb-1">
        <SortableContext items={cards.map((c) => "c:" + c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} disabled={dragDisabled} />
          ))}
        </SortableContext>
      </div>
      <AddCard listId={list.id} />
    </div>
  );
}

function AddCard({ listId }: { listId: string }) {
  const { data, mutate } = useBoard();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CardType>("task");

  async function add() {
    if (!title.trim()) return;
    const t = title;
    setTitle("");
    await mutate(() => api(`/api/boards/${data.board.id}/cards`, "POST", { title: t, listId, type }));
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="m-2 mt-1 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-300/60">
        + Tambah kartu
      </button>
    );
  return (
    <div className="space-y-2 p-2">
      <textarea autoFocus rows={2} className="w-full resize-none rounded-lg p-2 text-sm shadow outline-none" placeholder="Judul kartu…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void add(); } if (e.key === "Escape") setOpen(false); }} />
      <div className="flex items-center gap-1.5">
        <button onClick={add} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Tambah</button>
        <select value={type} onChange={(e) => setType(e.target.value as CardType)} className="rounded border bg-white px-1.5 py-1 text-xs">
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <button onClick={() => setOpen(false)} className="ml-auto rounded px-2 py-1 text-slate-500 hover:bg-slate-300">✕</button>
      </div>
    </div>
  );
}

function AddList() {
  const { data, mutate } = useBoard();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  async function add() {
    if (!name.trim()) return;
    const n = name;
    setName("");
    await mutate(() => api(`/api/boards/${data.board.id}/lists`, "POST", { name: n }));
  }
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-72 shrink-0 rounded-xl bg-white/25 px-3 py-2.5 text-left text-sm font-medium text-white hover:bg-white/35">
        + Tambah list
      </button>
    );
  return (
    <div className="w-72 shrink-0 space-y-2 rounded-xl bg-[#f1f2f4] p-2">
      <input autoFocus className="w-full rounded border-2 border-blue-500 px-2 py-1.5 text-sm" placeholder="Nama list…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); if (e.key === "Escape") setOpen(false); }} />
      <div className="flex gap-1.5">
        <button onClick={add} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">Tambah list</button>
        <button onClick={() => setOpen(false)} className="rounded px-2 text-slate-500 hover:bg-slate-300">✕</button>
      </div>
    </div>
  );
}
