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
import { ScrollHint } from "@/components/ui/ScrollHint";
import { confirmDialog } from "@/components/ui/Dialog";
import { api } from "@/lib/client";
import { canMove } from "@/lib/flow";
import { LABEL_COLORS, TYPE_META } from "@/lib/theme";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import type { Card, CardType, List } from "@/lib/types";
import { CardView, SortableCard } from "./CardTile";
import { useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";

type Columns = Record<string, string[]>;

const strip = (id: string) => id.slice(2);

function buildColumns(lists: List[], cards: Card[]): Columns {
  const cols: Columns = Object.fromEntries(lists.map((l) => [l.id, []]));
  for (const c of [...cards].sort((a, b) => a.position - b.position)) cols[c.list_id]?.push(c.id);
  return cols;
}

export function Kanban({ visible, draggingRef }: { visible: (c: Card) => boolean; draggingRef: React.RefObject<boolean> }) {
  const { data, mutate, perms } = useBoard();
  // a team workflow owns the columns of a linked board
  const structure = perms.structure && !data.board.workflow;
  const [listOrder, setListOrder] = useState(() => data.lists.map((l) => l.id));
  const [cols, setCols] = useState(() => buildColumns(data.lists, data.cards));
  const [active, setActive] = useState<string | null>(null);
  const origin = useRef<string | null>(null);
  // scroll box for the scroll hint
  const scrollBox = useRef<HTMLDivElement>(null);
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
      // the status flow decides which columns the card may enter
      if (!canMove(listById.get(origin.current ?? ""), to)) return prev;
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

    // dropped on a column the flow blocks: keep the card where it is now
    const overList = containerOf(o);
    const to = overList && canMove(listById.get(origin.current ?? ""), overList) ? overList : containerOf(a);
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
  // columns the dragged card may not enter
  const blocked = (listId: string) => !!activeCard && !canMove(listById.get(origin.current ?? ""), listId);

  return (
    <DndContext id="kanban" sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => ((draggingRef.current = false), setActive(null))}>
      <div className="relative h-full">
      <div ref={scrollBox} className="scroll-thin flex h-full items-start gap-3 overflow-x-auto p-3 sm:p-4">
        <SortableContext items={listOrder.map((id) => "l:" + id)} strategy={horizontalListSortingStrategy}>
          {listOrder.map((id) => {
            const list = listById.get(id);
            if (!list) return null;
            const cards = (cols[id] ?? []).map((cid) => cardById.get(cid)).filter((c): c is Card => !!c && visible(c));
            return <Column key={id} list={list} cards={cards} dragDisabled={filtering} blocked={blocked(id)} first={id === listOrder[0]} />;
          })}
        </SortableContext>
        {structure && <AddList />}
      </div>
      {/* "scroll" pill while more content is to the right */}
      <ScrollHint box={scrollBox} axis="x" />
      </div>
      <DragOverlay>
        {activeCard && <CardView card={activeCard} overlay />}
        {activeList && <div className="w-72 rounded-xl bg-column p-3 font-semibold shadow-xl" style={listTint(activeList.color)}>{activeList.name}</div>}
      </DragOverlay>
    </DndContext>
  );
}

// tint the column background with the list color (mixed so it works in light and dark);
// --col-bg lets the scroll fade match the tinted background
const listTint = (color: string | null): React.CSSProperties => {
  if (!color) return {};
  const bg = `color-mix(in srgb, ${color} 28%, var(--color-column))`;
  return { background: bg, boxShadow: `inset 0 3px 0 ${color}`, ["--col-bg" as string]: bg };
};

function Column({ list, cards, dragDisabled, blocked, first }: { list: List; cards: Card[]; dragDisabled: boolean; blocked: boolean; first: boolean }) {
  const { data, mutate, perms, canEdit } = useBoard();
  // columns are board structure (owned by the team workflow when linked); cards move only when the user may edit them
  const structure = perms.structure && !data.board.workflow;
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: "l:" + list.id, data: { type: "list" }, disabled: dragDisabled || !structure });
  const [editing, setEditing] = useState(false);
  // scrolling card list, for the scroll hint
  const cardsBox = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(list.name);
  const menu = usePopover({ placement: "bottom-end" });

  function rename() {
    setEditing(false);
    if (name.trim() && name !== list.name) void mutate(() => api(`/api/lists/${list.id}`, "PATCH", { name }));
    else setName(list.name);
  }

  // set or clear the list's color
  function setColor(color: string | null) {
    if (color !== list.color) void mutate(() => api(`/api/lists/${list.id}`, "PATCH", { color }));
  }

  return (
    <div ref={setNodeRef} data-tour={first ? "list" : undefined} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging || blocked ? 0.4 : 1, ...listTint(list.color) }} className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-column shadow-sm transition-opacity ${blocked ? "grayscale" : ""}`}>
      <div className="relative flex items-center gap-2 px-3 pt-2.5 pb-1.5" {...attributes} {...listeners}>
        {editing ? (
          <input autoFocus className="w-full rounded border-2 border-blue-500 px-1.5 py-0.5 text-sm font-semibold" value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Enter" && rename()} onPointerDown={(e) => e.stopPropagation()} />
        ) : (
          <h3 className={`flex-1 text-sm font-semibold ${structure ? "cursor-grab" : ""}`} onClick={() => structure && setEditing(true)}>
            {list.name}
            {list.is_done ? <span className="ml-1.5 rounded bg-green-100 px-1 text-[10px] font-medium text-green-700">DONE</span> : null}
          </h3>
        )}
        <span className="text-xs text-slate-500">{cards.length}</span>
        {structure && <button ref={menu.refs.setReference} onPointerDown={(e) => e.stopPropagation()} onClick={() => menu.setOpen(!menu.open)} className="rounded px-1.5 text-slate-500 hover:bg-slate-300">
          ⋯
        </button>}
        <PopoverPanel pop={menu} className="w-60 py-1 text-sm">
          {/* list color swatches */}
          <div className="px-3 pt-1.5 pb-2">
            <div className="mb-1.5 text-xs font-medium text-slate-500">Warna list</div>
            <div className="flex flex-wrap gap-1.5">
              <button title="Default" onClick={() => setColor(null)} className={`h-6 w-6 rounded-full border border-slate-300 bg-column transition hover:scale-110 ${!list.color ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} />
              {LABEL_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full transition hover:scale-110 ${list.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-slate-200" />
          <button className="block w-full px-3 py-2 text-left hover:bg-slate-100" onClick={() => (menu.setOpen(false), mutate(() => api(`/api/lists/${list.id}`, "PATCH", { is_done: !list.is_done })))}>
            {list.is_done ? "Hapus tanda 'selesai'" : "Tandai sebagai list selesai"}
          </button>
          <button className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50" onClick={async () => { menu.setOpen(false); if (await confirmDialog({ title: `Hapus list "${list.name}"?`, message: "Semua kartu di dalamnya ikut terhapus.", danger: true })) void mutate(() => api(`/api/lists/${list.id}`, "DELETE")); }}>
            Hapus list
          </button>
        </PopoverPanel>
      </div>
      {/* status flow hint: where cards in this list can go next */}
      {list.next_ids && (
        <div className="flex items-center gap-1 px-3 pb-1.5 text-[11px] text-slate-500" title={data.board.workflow ? `Alur status diatur Alur Kerja "${data.board.workflow.name}"` : "Alur status diatur admin board"}>
          <Icon name="arrow-right" className="h-3 w-3" />
          <span className="truncate">{list.next_ids.length ? data.lists.filter((l) => list.next_ids!.includes(l.id)).map((l) => l.name).join(", ") : "tidak bisa dipindah"}</span>
        </div>
      )}
      {blocked && <div className="mx-2 mb-1.5 rounded-md bg-black/5 px-2 py-1 text-center flex items-center justify-center gap-1 text-[11px] text-slate-500"><Icon name="ban" className="h-3 w-3" />Tidak sesuai alur status</div>}
      {/* card list scrolls inside the column; the pill shows while more cards are below */}
      <div className="relative flex min-h-0 flex-col">
        <div ref={cardsBox} className="scroll-thin flex min-h-2 flex-col gap-2 overflow-y-auto px-2 pt-0.5 pb-1">
          <SortableContext items={cards.map((c) => "c:" + c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c, i) => (
              <SortableCard key={c.id} card={c} disabled={dragDisabled || !canEdit(c)} tour={first && i === 0} />
            ))}
          </SortableContext>
        </div>
        <ScrollHint box={cardsBox} tint="column" />
      </div>
      {perms.createCard && <AddCard listId={list.id} tour={first} />}
    </div>
  );
}

function AddCard({ listId, tour }: { listId: string; tour?: boolean }) {
  const { data, mutate } = useBoard();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CardType>("task");
  const ref = useDismiss(open, () => setOpen(false));

  async function add() {
    if (!title.trim()) return;
    const t = title;
    setTitle("");
    await mutate(() => api(`/api/boards/${data.board.id}/cards`, "POST", { title: t, listId, type }));
  }

  if (!open)
    return (
      <button data-tour={tour ? "add-card" : undefined} onClick={() => setOpen(true)} className="m-2 mt-1 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-300/60">
        + Tambah kartu
      </button>
    );
  return (
    <div ref={ref} className="space-y-2 p-2">
      <textarea autoFocus rows={2} className="w-full resize-none rounded-lg p-2 text-sm shadow outline-none" placeholder="Judul kartu…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void add(); } if (e.key === "Escape") setOpen(false); }} />
      <div className="flex items-center gap-1.5">
        <button onClick={add} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-500">Tambah</button>
        {/* card type with its icon */}
        <Select
          value={type}
          onChange={setType}
          className="!h-8 !w-28 text-xs"
          options={(Object.keys(TYPE_META) as CardType[]).map((k) => ({ value: k, label: TYPE_META[k].label, icon: <span style={{ color: TYPE_META[k].color }}><Icon name={TYPE_META[k].icon} /></span> }))}
        />
        <button onClick={() => setOpen(false)} aria-label="Batal" className="ml-auto rounded px-2 py-1 text-slate-500 hover:bg-slate-300"><Icon name="x" /></button>
      </div>
    </div>
  );
}

// close an inline form when the user presses outside it
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // latest close without re-subscribing every render
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    // portaled dropdown menus count as inside
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest?.("[data-popover]")) return;
      closeRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);
  return ref;
}

function AddList() {
  const { data, mutate } = useBoard();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  async function add() {
    if (!name.trim()) return;
    const n = name;
    setName("");
    await mutate(() => api(`/api/boards/${data.board.id}/lists`, "POST", { name: n }));
  }
  if (!open)
    return (
      <button data-tour="add-list" onClick={() => setOpen(true)} className="w-72 shrink-0 rounded-xl bg-white/25 px-3 py-2.5 text-left text-sm font-medium text-white hover:bg-white/35">
        + Tambah list
      </button>
    );
  return (
    <div ref={ref} className="w-72 shrink-0 space-y-2 rounded-xl bg-column p-2">
      <input autoFocus className="w-full rounded border-2 border-blue-500 px-2 py-1.5 text-sm" placeholder="Nama list…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); if (e.key === "Escape") setOpen(false); }} />
      <div className="flex gap-1.5">
        <button onClick={add} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">Tambah list</button>
        <button onClick={() => setOpen(false)} aria-label="Batal" className="rounded px-2 text-slate-500 hover:bg-slate-300"><Icon name="x" /></button>
      </div>
    </div>
  );
}
