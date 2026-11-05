"use client";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { MemberStack } from "./MemberStack";
import { TopBar } from "@/components/TopBar";
import { Tour, type TourStep } from "@/components/Tour";
import { Select } from "@/components/ui/Select";
import { toastError } from "@/components/ui/Dialog";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { canEditCard } from "@/lib/permissions";
import { realtimeEnabled, useBoardChannel } from "@/lib/realtime";
import { boardBackground, boardBg, TYPE_META } from "@/lib/theme";
import { statusOf, usePresence } from "@/lib/usePresence";
import type { BoardData, Card } from "@/lib/types";
import { Backlog } from "./Backlog";
import { CardModal } from "./CardModal";
import { cardHelpers, Ctx, daysLeft } from "./context";
import { Kanban } from "./Kanban";
import { ListView } from "./ListView";
import { Settings } from "./Settings";
import { Storyline } from "./Storyline";
import { Icon } from "@/components/ui/Icon";

type View = "board" | "backlog" | "list" | "storyline";
// shared outline style so every tab icon matches
function TabIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// tab label plus its outline icon path
const VIEWS: { id: View; label: string; icon: string }[] = [
  // kanban columns
  { id: "board", label: "Board", icon: "M4.5 3.5h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM8 3.5v13M12 3.5v13" },
  // stacked layers
  { id: "backlog", label: "Backlog", icon: "M10 3 3 6.5 10 10l7-3.5L10 3ZM3 10l7 3.5 7-3.5M3 13.5 10 17l7-3.5" },
  // bulleted rows
  { id: "list", label: "List", icon: "M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.75 5.5h.01M3.75 10h.01M3.75 14.5h.01" },
  // timeline bars
  { id: "storyline", label: "Storyline", icon: "M3.5 3.5v13M6.5 6h6M8.5 10h8M6.5 14h5" },
];
const ORDER_KEY = "tl-view-order";

// first-visit walkthrough of a board
const TOUR: TourStep[] = [
  {
    title: "Ini board kamu",
    body: "Board menampilkan semua pekerjaan proyek. Setiap kolom adalah satu tahap kerja, dan setiap kartu adalah satu tugas (tiket). Begini cara pakainya:",
  },
  { target: "list", placement: "right", title: "List = tahap kerja", body: "Kolom seperti To Do, In Progress dan Done menunjukkan status kartu. Klik nama list untuk mengganti nama, tombol ⋯ untuk warna atau menandainya sebagai list \"selesai\". Geser judul list untuk mengubah urutan kolom." },
  { target: "card", title: "Kartu = satu tugas", body: "Klik kartu untuk melihat detailnya. Geser kartu ke kolom lain untuk mengubah statusnya, mis. dari To Do ke In Progress." },
  { target: "add-card", title: "Tambah kartu", body: "Tulis judul tugas lalu Enter. Pilih tipenya: Task (tugas biasa), Story (fitur dari sisi pengguna), Bug (masalah), atau Epic (tujuan besar yang menampung banyak story)." },
  { target: "add-list", title: "Tambah list", body: "Butuh tahap lain, misal \"QA\" atau \"Siap rilis\"? Tambahkan list baru di sini." },
  { target: "views", title: "Ganti tampilan", body: (<><b>Board</b>: kolom kanban. <b>Backlog</b>: rencanakan sprint (periode kerja 1–2 minggu). <b>List</b>: semua kartu dalam tabel. <b>Storyline</b>: epic dan story dalam timeline. Tab bisa digeser untuk atur urutan.</>) },
  { target: "filters", title: "Cari & saring", body: "Cari kartu dari judul atau kode (mis. WEB-12). Saring per tipe, per orang, atau pilih \"Tugas saya\" untuk melihat pekerjaanmu saja." },
  { target: "share", title: "Undang & atur board", body: "Undang orang lewat link atau email, atur perannya, warna board, label, dan alur status (kolom mana boleh pindah ke mana). Di sini juga terlihat hak akses kamu." },
  { target: "board-switcher", title: "Pindah board cepat", body: "Klik nama board di atas untuk loncat ke board lain tanpa kembali ke halaman utama." },
];

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
        <div data-tour="views" className="flex rounded-lg bg-black/20 p-0.5 text-sm" title="Geser untuk mengatur urutan">
          {order.map((id) => <ViewTab key={id} id={id} active={view === id} onSelect={onSelect} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// one draggable tab
function ViewTab({ id, active, onSelect }: { id: View; active: boolean; onSelect: (v: View) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { label, icon } = VIEWS.find((v) => v.id === id)!;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(id)}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex touch-none items-center gap-1.5 rounded-md px-2.5 py-1 whitespace-nowrap select-none ${active ? "bg-surface font-medium text-slate-800" : "hover:bg-white/15"} ${isDragging ? "relative z-10 cursor-grabbing shadow-lg ring-2 ring-white/60" : "cursor-pointer"}`}
    >
      <TabIcon d={icon} />
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

  // expose the board gradient for theme-aware accents (scroll hint pill), also in portaled modals
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--board-bg", boardBg(data.board.color));
    return () => void root.removeProperty("--board-bg");
  }, [data.board.color]);

  const refresh = useCallback(async () => {
    setData(await api<BoardData>(`/api/boards/${initial.board.id}`));
  }, [initial.board.id]);

  // reload when another member changes the board (skipped mid-drag)
  const ping = useBoardChannel(initial.board.id, () => {
    if (!dragging.current) refresh().catch(() => {});
  });

  // who is online on this board (null = feature off)
  const presence = usePresence({ boardId: initial.board.id });

  const mutate = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        ping();
      } catch (e) {
        toastError(e);
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

  // open the card named in the url (?card=TKO-12) on first load; match by number so a renamed key still works
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("card");
    const num = Number(ref?.match(/(\d+)$/)?.[1]);
    const hit = initial.cards.find((c) => c.id === ref || c.number === num);
    if (hit) setOpenId(hit.id);
  }, [initial.cards]);

  // mirror the open card in the url so it can be copied and shared
  const shown = data.cards.find((c) => c.id === openId);
  const urlKey = shown ? `${data.board.key}-${shown.number}` : null;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (urlKey) url.searchParams.set("card", urlKey);
    else url.searchParams.delete("card");
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [urlKey]);

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
  const visible = (c: Card) => matchQ(c) && (!fType || c.type === fType) && (!fMember || c.assignees.includes(fMember) || c.subtasks.some((s) => s.assignees.includes(fMember))) && matchSprint(c);
  const openCard = data.cards.find((c) => c.id === openId);
  const isAdmin = data.perms.admin;
  const canEdit = (c: Card) => canEditCard(data.perms, c, user.id);
  const filtering = !!(q || fType || fMember || fSprint);
  const sprintCards = activeSprint ? data.cards.filter((c) => c.sprint_id === activeSprint.id) : [];
  const sprintPts = points(sprintCards);
  const sprintLeft = daysLeft(activeSprint?.end_date ?? null);

  return (
    <Ctx.Provider value={{ data, user, refresh, mutate, openCard: setOpenId, isAdmin, perms: data.perms, canEdit, presence }}>
      <div className="flex h-screen flex-col" style={{ background: `linear-gradient(var(--board-dim), var(--board-dim)), ${boardBackground(data.board)}` }}>
        <TopBar user={user} dark board={data.board} />
        <div className="flex flex-wrap items-center gap-2 bg-black/15 px-3 py-2 text-white sm:px-4">
          <h1 className="mr-2 text-lg font-bold drop-shadow">{data.board.name}</h1>
          <ViewTabs view={view} onSelect={switchView} />
          <div data-tour="filters" className="flex flex-wrap items-center gap-1.5 text-sm">
            {/* search box with an outline magnifier that follows the text color */}
            <label className="relative flex items-center text-white/70 focus-within:text-slate-400">
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-2.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="8.75" cy="8.75" r="5.25" />
                <path d="m12.75 12.75 3.75 3.75" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kartu" className="h-8 w-40 rounded-lg bg-white/15 pr-2.5 pl-8 text-white ring-1 ring-white/15 placeholder-white/70 outline-none transition focus:w-52 focus:bg-surface focus:text-slate-800 focus:placeholder-slate-400 focus:ring-blue-200" />
            </label>
            <Select
              variant="dark"
              value={fType}
              options={[{ value: "", label: "Semua tipe" }, ...Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label, icon: <span style={{ color: v.color }}><Icon name={v.icon} /></span> }))]}
              onChange={setFType}
              menuWidth={190}
            />
            <Select
              variant="dark"
              value={fMember}
              searchable={data.members.length > 6}
              options={[
                { value: "", label: "Semua member" },
                { value: user.id, label: "Tugas saya", icon: <Avatar name={user.name} color={user.color} src={user.avatar} size={20} /> },
                ...data.members.filter((m) => m.id !== user.id).map((m) => ({ value: m.id, label: m.name, icon: <Avatar name={m.name} color={m.color} src={m.avatar} size={20} online={statusOf(presence, m.id)?.online} /> })),
              ]}
              onChange={setFMember}
              menuWidth={220}
            />
            {data.sprints.length > 0 && (
              <Select
                variant="dark"
                value={fSprint}
                searchable={data.sprints.length > 6}
                options={[
                  { value: "", label: "Semua sprint" },
                  ...(activeSprint ? [{ value: "active", label: "Sprint aktif", description: activeSprint.name, icon: <span className="block h-2 w-2 rounded-full bg-green-500" /> }] : []),
                  ...data.sprints.filter((s) => s.status === "planned").map((s) => ({ value: s.id, label: s.name, group: "Direncanakan", icon: <span className="block h-2 w-2 rounded-full bg-slate-300" /> })),
                  // completed sprints, newest first, so older work stays findable
                  ...data.sprints
                    .filter((s) => s.status === "completed")
                    .sort((a, b) => b.created_at - a.created_at)
                    .map((s) => ({ value: s.id, label: s.name, group: "Selesai", icon: <Icon name="check" className="h-3.5 w-3.5 text-green-600" /> })),
                  { value: "none", label: "Belum masuk sprint", icon: <Icon name="list" className="h-4 w-4 text-slate-400" /> },
                ]}
                onChange={setFSprint}
                menuWidth={220}
              />
            )}
            {filtering && <button onClick={() => (setQ(""), setFType(""), setFMember(""), setFSprint(""))} className="h-8 rounded-lg px-2.5 hover:bg-white/20">Reset</button>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* member avatars: online first, spread out on hover, rest behind "+N" */}
            <MemberStack onManage={() => setSettings(true)} />
            <button data-tour="share" onClick={() => setSettings(true)} className="rounded-md bg-surface px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-100">
              Bagikan / Atur
            </button>
          </div>
        </div>
        {activeSprint && view === "board" && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-black/25 px-4 py-1.5 text-xs text-white">
            <b className="flex items-center gap-1"><Icon name="sprint" className="h-3.5 w-3.5" />{activeSprint.name}</b>
            {sprintLeft !== null && <span>{sprintLeft < 0 ? `lewat ${-sprintLeft} hari` : `${sprintLeft} hari lagi`}</span>}
            <span>{sprintPts.done}/{sprintPts.total} poin</span>
            <span className="h-1.5 w-24 overflow-hidden rounded bg-white/25">
              <span className="block h-full bg-white" style={{ width: `${sprintPts.total ? (sprintPts.done / sprintPts.total) * 100 : 0}%` }} />
            </span>
            {activeSprint.goal && <span className="flex min-w-0 items-center gap-1 opacity-80"><Icon name="target" className="h-3.5 w-3.5" /><span className="truncate">{activeSprint.goal}</span></span>}
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
      {/* the card tour goes first when a card link opens a card on load */}
      <Tour id="board" steps={TOUR} seen={user.tours} enabled={!openCard && !settings && view === "board"} />
    </Ctx.Provider>
  );
}
