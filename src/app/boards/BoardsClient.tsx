"use client";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { TeamAvatar } from "@/components/TeamAvatar";
import { TopBar } from "@/components/TopBar";
import { Tour, type TourStep } from "@/components/Tour";
import { toast, toastError } from "@/components/ui/Dialog";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { isAdminRole, ROLE_LABEL, type Role } from "@/lib/permissions";
import { boardBackground, boardBg } from "@/lib/theme";
import { uploadBoardBackground } from "@/lib/image";
import { BackgroundPicker, IconPicker } from "@/components/BoardLook";
import { slimTrello } from "@/lib/trello";
import { CreateTeamModal } from "./CreateTeamModal";
import { TeamModal } from "./TeamModal";

type Row = { id: string; name: string; description: string; color: string; background: string | null; icon: string | null; role: string; member_count: number; card_count: number; team_ids: string[] };
type Team = { id: string; name: string; avatar: string | null; role: string; member_count: number; board_count: number; can_create_board: boolean };

// first-visit walkthrough of the boards page
const TOUR: TourStep[] = [
  {
    title: "Selamat datang di Tasklace",
    body: (
      <>
        Tasklace membantu tim mengatur pekerjaan. Isinya sederhana: <b>board</b> (papan proyek) berisi <b>list</b> (tahap kerja, mis. To Do → Done), dan list berisi <b>kartu</b> (satu tugas / tiket). Yuk lihat sebentar fitur-fiturnya.
      </>
    ),
  },
  { target: "new-board", title: "Buat board", body: "Satu board untuk satu proyek, mis. \"Website Toko\". Board baru langsung punya list Backlog, To Do, In Progress, Review, dan Done." },
  { target: "board-tile", title: "Buka & atur urutan board", body: "Klik board untuk membukanya. Tahan lalu geser board untuk mengatur urutannya, misalnya taruh board prioritas di paling depan. Urutan ini hanya untuk kamu." },
  { target: "new-team", title: "Kerja bareng tim", body: "Buat tim untuk berbagi beberapa board sekaligus. Siapa pun yang gabung ke tim otomatis bisa membuka semua board tim." },
  { target: "team-manage", title: "Member & hak akses", body: "Di sini kamu mengundang orang dan mengatur perannya: Admin, Member, atau Viewer (hanya lihat). Atur juga siapa yang boleh membuat board, membuat dan mengubah kartu." },
  { target: "import", title: "Pindahan dari Trello?", body: "Export board Trello sebagai JSON, lalu upload di sini. List, kartu, label dan komentar ikut masuk." },
  { target: "profile", title: "Profil & tema", body: "Ubah nama, foto dan password, ganti tema terang/gelap, atau buka tutorial ini lagi kapan saja dari menu ini." },
];
export function BoardsClient({ user, openTeam }: { user: User; openTeam?: string }) {
  const router = useRouter();
  const [boards, setBoards] = useState<Row[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; color: string; background: string | null; icon: string | null }>({ name: "", description: "", color: "blue", background: null, icon: null });
  // a photo picked in the new-board form, uploaded once the board exists
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // section being imported into ("" = personal, or a team id)
  const [importing, setImporting] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(openTeam ?? null);
  const [newTeam, setNewTeam] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // set while dragging so the drop doesn't also open the board
  const dragged = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // boards and teams together so sections stay in sync
  const load = useCallback(async () => {
    const [b, t] = await Promise.all([api<Row[]>("/api/boards"), api<Team[]>("/api/teams")]);
    setBoards(b);
    setTeams(t);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // creating ("" = personal, or a team id) opens the new-board form
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Membuat…");
    try {
      const usePhoto = form.background === "u" && photo;
      const { id } = await api<{ id: string }>("/api/boards", "POST", { ...form, background: usePhoto ? null : form.background, teamId: creating || undefined });
      // the board exists now, so its photo can go up (a failed upload still opens the board)
      if (usePhoto) await uploadBoardBackground(id, photo.file, setBusy).catch(toastError);
      router.push(`/b/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  // after the new-team form: refresh, then open the team so the invite link is at hand
  async function teamCreated(id: string) {
    setNewTeam(false);
    await load();
    setManaging(id);
  }

  // read a trello json export in the browser, send only what tasklace needs
  async function importTrello(file: File, teamId: string) {
    setImporting(teamId);
    try {
      const slim = slimTrello(JSON.parse(await file.text()));
      const url = teamId ? `/api/import/trello?team=${encodeURIComponent(teamId)}` : "/api/import/trello";
      const r = await api<{ id: string; cards: number; comments: number }>(url, "POST", slim);
      toast(`Import selesai: ${r.cards} kartu, ${r.comments} komentar.`, "success");
      router.push(`/b/${r.id}`);
    } catch (err) {
      toastError(err instanceof SyntaxError ? new Error("File bukan JSON yang valid") : err);
      setImporting(null);
    }
  }

  // drag ids are "section:board" because a board can show in several team sections;
  // the section's new order is written back into the same slots of the overall order
  function onDragEnd({ active, over }: DragEndEvent) {
    setDragId(null);
    setTimeout(() => (dragged.current = false));
    if (!boards || !over || active.id === over.id) return;
    const [sec, from] = String(active.id).split("|");
    const [overSec, to] = String(over.id).split("|");
    if (sec !== overSec) return;
    const ids = sectionBoards(sec).map((b) => b.id);
    const moved = arrayMove(ids, ids.indexOf(from), ids.indexOf(to));
    const slots = new Set(ids);
    const byId = new Map(boards.map((b) => [b.id, b]));
    let k = 0;
    const next = boards.map((b) => (slots.has(b.id) ? byId.get(moved[k++])! : b));
    setBoards(next);
    api("/api/boards", "PUT", { ids: next.map((b) => b.id) }).catch((e) => (toastError(e), void load()));
  }

  const myTeamIds = new Set(teams.map((t) => t.id));
  const personal = boards?.filter((b) => !b.team_ids.some((id) => myTeamIds.has(id))) ?? [];
  const sectionBoards = (sec: string) => (sec === "me" ? personal : (boards?.filter((b) => b.team_ids.includes(sec)) ?? []));
  const dragging = dragId ? boards?.find((b) => b.id === dragId.split("|")[1]) : undefined;
  // the tour points at the first tile on the page (team sections come first)
  const tourSec = [...teams.map((t) => t.id), "me"].find((s) => sectionBoards(s).length);
  // new-board preview: the picked local photo, else the chosen scene or color
  const draftBg = form.background === "u" && photo ? `url("${photo.url}") center / cover no-repeat, ${boardBg(form.color)}` : boardBackground({ id: "", color: form.color, background: form.background });
  const tile = "flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-surface/60 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600";

  // trello import tile for a section ("" = personal, or a team id)
  const importTile = (teamId: string, tour?: boolean) => (
    <label data-tour={tour ? "import" : undefined} className={`${tile} cursor-pointer flex-col gap-1 ${importing !== null ? "pointer-events-none opacity-60" : ""}`}>
      {/* import label with upload icon */}
      <span className="inline-flex items-center gap-1.5">{importing === teamId ? "Mengimpor…" : <><Icon name="upload" />Import dari Trello</>}</span>
      <span className="px-4 text-center text-xs text-slate-400">Trello: menu board → Print, export, and share → Export as JSON</span>
      <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importTrello(f, teamId); }} />
    </label>
  );

  // a section's tiles, sortable by drag
  const grid = (sec: string, extra: React.ReactNode) => {
    const list = sectionBoards(sec);
    return (
      <SortableContext items={list.map((b) => `${sec}|${b.id}`)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((b, i) => <SortableTile key={b.id} id={`${sec}|${b.id}`} b={b} tour={sec === tourSec && i === 0} dragged={dragged} />)}
          {extra}
        </div>
      </SortableContext>
    );
  };

  return (
    <div className="min-h-screen">
      <TopBar user={user} />
      <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="mb-1 text-2xl font-bold">Halo, {user.name.split(" ")[0]}</h1>
            <p className="text-slate-500">Semua board dan tim kamu. Undang member sebanyak apa pun, gratis.</p>
          </div>
          <button data-tour="new-team" onClick={() => setNewTeam(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-500">
            + Buat tim
          </button>
        </div>

        {boards && boards.length > 1 && <p className="-mt-5 text-xs text-slate-400">Tip: tahan &amp; geser board untuk mengatur urutan prioritasnya.</p>}

        <DndContext id="boards" sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => ((dragged.current = true), setDragId(String(e.active.id)))} onDragEnd={onDragEnd} onDragCancel={() => ((dragged.current = false), setDragId(null))}>
        {teams.map((t, ti) => (
          <section key={t.id}>
            <div className="mb-3 flex items-center gap-2">
              <TeamAvatar name={t.name} src={t.avatar} size={28} />
              <h2 className="text-lg font-bold">{t.name}</h2>
              <span className="text-sm text-slate-500">{t.member_count} member</span>
              <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{ROLE_LABEL[t.role as Role] ?? t.role}</span>
              <button data-tour={ti === 0 ? "team-manage" : undefined} onClick={() => setManaging(t.id)} className="ml-auto rounded-md border bg-surface px-3 py-1 text-sm hover:bg-slate-50">
                {isAdminRole(t.role) ? "Kelola tim" : "Lihat tim"}
              </button>
            </div>
            {grid(
              t.id,
              t.can_create_board && (
                <>
                  <button onClick={() => setCreating(t.id)} className={tile}>
                    + Board baru di tim ini
                  </button>
                  {importTile(t.id)}
                </>
              ),
            )}
          </section>
        ))}

        <section>
          <h2 className="mb-3 text-lg font-bold">{teams.length ? "Board lain" : "Board saya"}</h2>
          {grid(
            "me",
            <>
            <button data-tour="new-board" onClick={() => setCreating("")} className={tile}>
              + Buat board baru
            </button>
            {importTile("", true)}
            </>,
          )}
        </section>
        <DragOverlay>{dragging && <Tile b={dragging} overlay />}</DragOverlay>
        </DndContext>
      </main>

      {/* hold the tour until boards are loaded and no modal is open */}
      <Tour id="boards" steps={TOUR} seen={user.tours} enabled={!!boards && creating === null && !managing && !newTeam} />

      {creating !== null && (
        <Modal onClose={() => setCreating(null)} width={520}>
          <form onSubmit={create} className="space-y-4 p-6">
            <h2 className="text-lg font-bold">Board baru</h2>
            {/* live preview of the board look */}
            <div className="flex h-24 items-end gap-2 rounded-lg p-3 font-bold text-white" style={{ background: draftBg }}>
              {form.icon && <BoardIconChip name={form.icon} />}
              <span className="drop-shadow">{form.name || "Nama board"}</span>
            </div>
            <input autoFocus className="w-full rounded-lg border px-3 py-2" placeholder="Nama board, mis. Website Toko" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Deskripsi (opsional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-600">Background</div>
              <BackgroundPicker
                color={form.color}
                background={form.background}
                photo={photo?.url ?? null}
                onPick={(v) => setForm({ ...form, ...("color" in v ? { color: v.color, background: null } : { background: v.background }) })}
                onUpload={(file) => {
                  if (!file.type.startsWith("image/")) return toastError(new Error("File harus berupa gambar"));
                  if (photo) URL.revokeObjectURL(photo.url);
                  setPhoto({ file, url: URL.createObjectURL(file) });
                  setForm({ ...form, background: "u" });
                }}
                onRemovePhoto={() => {
                  if (photo) URL.revokeObjectURL(photo.url);
                  setPhoto(null);
                  if (form.background === "u") setForm({ ...form, background: null });
                }}
              />
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-600">Ikon</div>
              <IconPicker board={{ id: "", color: form.color, background: form.background === "u" ? null : form.background, icon: form.icon }} onPick={(icon) => setForm({ ...form, icon })} />
            </div>
            <div className="block text-sm text-slate-600">
              Tim
              {/* team the new board goes into */}
              <Select
                value={creating}
                onChange={setCreating}
                className="mt-1"
                searchable={teams.length > 6}
                options={[
                  { value: "", label: "Tanpa tim (pribadi)", description: "Hanya kamu dan yang kamu undang" },
                  ...teams.filter((t) => t.can_create_board).map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-slate-500">Board baru otomatis berisi list Backlog → To Do → In Progress → Review → Done.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(null)} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100">Batal</button>
              <button disabled={!!busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:hover:bg-blue-500">{busy ?? "Buat"}</button>
            </div>
          </form>
        </Modal>
      )}

      {newTeam && <CreateTeamModal myBoards={boards ?? []} onClose={() => setNewTeam(false)} onCreated={(id) => void teamCreated(id)} />}

      {managing && (
        <TeamModal teamId={managing} user={user} myBoards={boards ?? []} onClose={() => (setManaging(null), router.replace("/boards"))} onChanged={() => void load()} />
      )}
    </div>
  );
}

// board icon on a frosted square, for tiles and the new-board preview
function BoardIconChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/25 backdrop-blur-sm">
      <Icon name={name as IconName} className="h-4 w-4" />
    </span>
  );
}

// board tile body (also used as the drag preview)
function Tile({ b, overlay }: { b: Row; overlay?: boolean }) {
  return (
    <div className={`relative h-28 overflow-hidden rounded-xl p-4 text-white shadow-sm ${overlay ? "rotate-2 cursor-grabbing shadow-xl ring-2 ring-white/70" : ""}`} style={{ background: boardBackground(b, true) }}>
      {/* soft shade keeps white text readable on bright photos */}
      {b.background && <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/35" />}
      <div className="relative flex items-center gap-2 font-bold drop-shadow">
        {b.icon && <BoardIconChip name={b.icon} />}
        <span className="min-w-0 truncate">{b.name}</span>
      </div>
      {b.description && <div className="relative line-clamp-1 text-sm opacity-90 drop-shadow">{b.description}</div>}
      <div className="absolute bottom-3 left-4 flex items-center gap-3 text-xs opacity-90">
        {/* member and card counts */}
        <span className="inline-flex items-center gap-1" title="Member"><Icon name="users" className="h-3.5 w-3.5" />{b.member_count}</span>
        <span className="inline-flex items-center gap-1" title="Kartu"><Icon name="note" className="h-3.5 w-3.5" />{b.card_count}</span>
        {b.role !== "member" && <span className="rounded bg-white/25 px-1.5">{ROLE_LABEL[b.role as Role] ?? b.role}</span>}
      </div>
    </div>
  );
}

// a board tile that opens on click and can be dragged to a new spot
function SortableTile({ id, b, tour, dragged }: { id: string; b: Row; tour: boolean; dragged: React.RefObject<boolean> }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <Link
      ref={setNodeRef}
      href={`/b/${b.id}`}
      data-tour={tour ? "board-tile" : undefined}
      // a drop ends with a click on the tile; ignore that one
      onClick={(e) => dragged.current && e.preventDefault()}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="block rounded-xl transition-shadow hover:shadow-lg"
      {...attributes}
      {...listeners}
    >
      <Tile b={b} />
    </Link>
  );
}
