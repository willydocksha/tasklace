"use client";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/TopBar";
import { Select } from "@/components/ui/Select";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { realtimeEnabled, useBoardChannel } from "@/lib/realtime";
import { boardBg, TYPE_META } from "@/lib/theme";
import type { BoardData, Card } from "@/lib/types";
import { Backlog } from "./Backlog";
import { CardModal } from "./CardModal";
import { cardHelpers, Ctx, daysLeft } from "./context";
import { Kanban } from "./Kanban";
import { ListView } from "./ListView";
import { Settings } from "./Settings";
import { Storyline } from "./Storyline";

type View = "board" | "backlog" | "list" | "storyline";
const VIEWS: { id: View; label: string }[] = [
  { id: "board", label: "▦ Board" },
  { id: "backlog", label: "🏃 Backlog" },
  { id: "list", label: "☰ List" },
  { id: "storyline", label: "📚 Storyline" },
];
const ORDER_KEY = "tl-view-order";

// view switcher; tabs can be dragged into a new order (remembered on this device)
function ViewTabs({ view, onSelect }: { view: View; onSelect: (v: View) => void }) {
  const [order, setOrder] = useState<View[]>(VIEWS.map((v) => v.id));
  // small drag distance so a plain click still switches the view
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // load the saved order, keeping only known views and appending new ones
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as View[];
      const known = saved.filter((id) => VIEWS.some((v) => v.id === id));
      setOrder([...known, ...VIEWS.map((v) => v.id).filter((id) => !known.includes(id))]);
    } catch {}
  }, []);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(active.id as View), order.indexOf(over.id as View));
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {}
  }

  return (
    <DndContext id="view-tabs" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        <div className="flex rounded-lg bg-black/20 p-0.5 text-sm" title="Geser untuk mengatur urutan">
          {order.map((id) => <ViewTab key={id} id={id} active={view === id} onSelect={onSelect} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// one draggable tab
function ViewTab({ id, active, onSelect }: { id: View; active: boolean; onSelect: (v: View) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const label = VIEWS.find((v) => v.id === id)!.label;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(id)}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-none rounded-md px-2.5 py-1 whitespace-nowrap select-none ${active ? "bg-white font-medium text-slate-800" : "hover:bg-white/15"} ${isDragging ? "relative z-10 cursor-grabbing shadow-lg ring-2 ring-white/60" : "cursor-pointer"}`}
    >
      {label}
    </button>
  );
}

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
  // "" all, "active" current sprint, "none" backlog only, or a sprint id
  const [fSprint, setFSprint] = useState("");
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
      if (VIEWS.some((x) => x.id === v)) setView(v as View);
    } catch {}
  }, [initial.board.id]);
  const switchView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(`tb-view-${initial.board.id}`, v);
    } catch {}
  };

  const activeSprint = data.sprints.find((s) => s.status === "active");
  const { keyOf, points } = cardHelpers(data);
  // search matches title or issue key (e.g. "tlc-12")
  const matchQ = (c: Card) => !q || c.title.toLowerCase().includes(q.toLowerCase()) || keyOf(c).toLowerCase() === q.trim().toLowerCase();
  const matchSprint = (c: Card) =>
    !fSprint || (fSprint === "none" ? !c.sprint_id : fSprint === "active" ? !!activeSprint && c.sprint_id === activeSprint.id : c.sprint_id === fSprint);
  const visible = (c: Card) => matchQ(c) && (!fType || c.type === fType) && (!fMember || c.assignees.includes(fMember)) && matchSprint(c);
  const openCard = data.cards.find((c) => c.id === openId);
  const isAdmin = data.role !== "member";
  const filtering = !!(q || fType || fMember || fSprint);
  const sprintCards = activeSprint ? data.cards.filter((c) => c.sprint_id === activeSprint.id) : [];
  const sprintPts = points(sprintCards);
  const sprintLeft = daysLeft(activeSprint?.end_date ?? null);

  return (
    <Ctx.Provider value={{ data, user, refresh, mutate, openCard: setOpenId, isAdmin }}>
      <div className="flex h-screen flex-col" style={{ background: boardBg(data.board.color) }}>
        <TopBar user={user} dark />
        <div className="flex flex-wrap items-center gap-2 bg-black/15 px-3 py-2 text-white sm:px-4">
          <h1 className="mr-2 text-lg font-bold drop-shadow">{data.board.name}</h1>
          <ViewTabs view={view} onSelect={switchView} />
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari kartu" className="h-8 w-40 rounded-lg bg-white/15 px-2.5 ring-1 ring-white/15 placeholder-white/70 outline-none transition focus:w-52 focus:bg-white focus:text-slate-800 focus:placeholder-slate-400 focus:ring-blue-200" />
            <Select
              variant="dark"
              value={fType}
              options={[{ value: "", label: "Semua tipe" }, ...Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label, icon: <span style={{ color: v.color }}>{v.icon}</span> }))]}
              onChange={setFType}
              menuWidth={190}
            />
            <Select
              variant="dark"
              value={fMember}
              searchable={data.members.length > 6}
              options={[
                { value: "", label: "Semua member" },
                { value: user.id, label: "Tugas saya", icon: <Avatar name={user.name} color={user.color} size={20} /> },
                ...data.members.filter((m) => m.id !== user.id).map((m) => ({ value: m.id, label: m.name, icon: <Avatar name={m.name} color={m.color} size={20} /> })),
              ]}
              onChange={setFMember}
              menuWidth={220}
            />
            {data.sprints.some((s) => s.status !== "completed") && (
              <Select
                variant="dark"
                value={fSprint}
                options={[
                  { value: "", label: "Semua sprint" },
                  ...(activeSprint ? [{ value: "active", label: "Sprint aktif", description: activeSprint.name, icon: <span className="block h-2 w-2 rounded-full bg-green-500" /> }] : []),
                  ...data.sprints.filter((s) => s.status === "planned").map((s) => ({ value: s.id, label: s.name, icon: <span className="block h-2 w-2 rounded-full bg-slate-300" /> })),
                  { value: "none", label: "Belum masuk sprint", icon: <span className="text-slate-400">☰</span> },
                ]}
                onChange={setFSprint}
                menuWidth={220}
              />
            )}
            {filtering && <button onClick={() => (setQ(""), setFType(""), setFMember(""), setFSprint(""))} className="h-8 rounded-lg px-2.5 hover:bg-white/20">Reset</button>}
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
        {activeSprint && view === "board" && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-black/25 px-4 py-1.5 text-xs text-white">
            <b>🏃 {activeSprint.name}</b>
            {sprintLeft !== null && <span>{sprintLeft < 0 ? `lewat ${-sprintLeft} hari` : `${sprintLeft} hari lagi`}</span>}
            <span>{sprintPts.done}/{sprintPts.total} poin</span>
            <span className="h-1.5 w-24 overflow-hidden rounded bg-white/25">
              <span className="block h-full bg-white" style={{ width: `${sprintPts.total ? (sprintPts.done / sprintPts.total) * 100 : 0}%` }} />
            </span>
            {activeSprint.goal && <span className="truncate opacity-80">🎯 {activeSprint.goal}</span>}
            <button onClick={() => setFSprint(fSprint === "active" ? "" : "active")} className="ml-auto rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">
              {fSprint === "active" ? "Tampilkan semua" : "Hanya sprint ini"}
            </button>
          </div>
        )}
        {filtering && view === "board" && <div className="bg-amber-100 px-4 py-1 text-xs text-amber-800">Filter aktif, drag &amp; drop dimatikan sementara.</div>}
        <div className="min-h-0 flex-1">
          {view === "board" && <Kanban visible={visible} draggingRef={dragging} />}
          {view === "backlog" && <Backlog visible={visible} />}
          {view === "list" && <ListView visible={visible} />}
          {view === "storyline" && <Storyline visible={visible} />}
        </div>
      </div>
      {openCard && <CardModal card={openCard} onClose={() => setOpenId(null)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </Ctx.Provider>
  );
}
