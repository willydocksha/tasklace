"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { TopBar } from "@/components/TopBar";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { BOARD_COLORS, boardBg } from "@/lib/theme";
import { slimTrello } from "@/lib/trello";
import { TeamModal } from "./TeamModal";

type Row = { id: string; name: string; description: string; color: string; role: string; member_count: number; card_count: number; team_ids: string[] };
type Team = { id: string; name: string; role: string; member_count: number; board_count: number };

export function BoardsClient({ user, openTeam }: { user: User; openTeam?: string }) {
  const router = useRouter();
  const [boards, setBoards] = useState<Row[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "blue" });
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [managing, setManaging] = useState<string | null>(openTeam ?? null);

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
    try {
      const { id } = await api<{ id: string }>("/api/boards", "POST", { ...form, teamId: creating || undefined });
      router.push(`/b/${id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createTeam() {
    const name = prompt("Nama tim baru");
    if (!name?.trim()) return;
    const { id } = await api<{ id: string }>("/api/teams", "POST", { name });
    await load();
    setManaging(id);
  }

  // read a trello json export in the browser, send only what tasklace needs
  async function importTrello(file: File) {
    setImporting(true);
    try {
      const slim = slimTrello(JSON.parse(await file.text()));
      const r = await api<{ id: string; cards: number; comments: number }>("/api/import/trello", "POST", slim);
      alert(`Import selesai: ${r.cards} kartu, ${r.comments} komentar.`);
      router.push(`/b/${r.id}`);
    } catch (err) {
      alert(err instanceof SyntaxError ? "File bukan JSON yang valid" : (err as Error).message);
      setImporting(false);
    }
  }

  const myTeamIds = new Set(teams.map((t) => t.id));
  const personal = boards?.filter((b) => !b.team_ids.some((id) => myTeamIds.has(id))) ?? [];
  const tile = "flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-surface/60 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600";

  // one board tile
  const card = (b: Row) => (
    <Link key={b.id} href={`/b/${b.id}`} className="group relative h-28 overflow-hidden rounded-xl p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" style={{ background: boardBg(b.color) }}>
      <div className="font-bold drop-shadow">{b.name}</div>
      {b.description && <div className="line-clamp-1 text-sm opacity-80">{b.description}</div>}
      <div className="absolute bottom-3 left-4 flex gap-3 text-xs opacity-90">
        <span>👥 {b.member_count}</span>
        <span>🗒️ {b.card_count}</span>
        {b.role !== "member" && <span className="rounded bg-white/25 px-1.5">{b.role}</span>}
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen">
      <TopBar user={user} />
      <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="mb-1 text-2xl font-bold">Halo, {user.name.split(" ")[0]} 👋</h1>
            <p className="text-slate-500">Semua board dan tim kamu. Undang member sebanyak apa pun, gratis.</p>
          </div>
          <button onClick={createTeam} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-500">
            + Buat tim
          </button>
        </div>

        {teams.map((t) => (
          <section key={t.id}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold">👥 {t.name}</h2>
              <span className="text-sm text-slate-500">{t.member_count} member</span>
              <button onClick={() => setManaging(t.id)} className="ml-auto rounded-md border bg-surface px-3 py-1 text-sm hover:bg-slate-50">
                {t.role === "member" ? "Lihat tim" : "Kelola tim"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {boards?.filter((b) => b.team_ids.includes(t.id)).map(card)}
              {t.role !== "member" && (
                <button onClick={() => setCreating(t.id)} className={tile}>
                  + Board baru di tim ini
                </button>
              )}
            </div>
          </section>
        ))}

        <section>
          <h2 className="mb-3 text-lg font-bold">{teams.length ? "Board lain" : "Board saya"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {personal.map(card)}
            <button onClick={() => setCreating("")} className={tile}>
              + Buat board baru
            </button>
            <label className={`${tile} cursor-pointer flex-col gap-1 ${importing ? "pointer-events-none opacity-60" : ""}`}>
              <span>{importing ? "Mengimpor…" : "⇪ Import dari Trello"}</span>
              <span className="px-4 text-center text-xs text-slate-400">Trello: menu board → Print, export, and share → Export as JSON</span>
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importTrello(f); }} />
            </label>
          </div>
        </section>
      </main>

      {creating !== null && (
        <Modal onClose={() => setCreating(null)} width={440}>
          <form onSubmit={create} className="space-y-4 p-6">
            <h2 className="text-lg font-bold">Board baru</h2>
            <div className="flex h-24 items-end rounded-lg p-3 font-bold text-white" style={{ background: boardBg(form.color) }}>
              {form.name || "Nama board"}
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-600">Warna background</div>
              <div className="grid grid-cols-6 gap-2">
                {Object.keys(BOARD_COLORS).map((c) => (
                  <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} className={`h-9 rounded-md ${form.color === c ? "ring-2 ring-blue-500 ring-offset-2" : ""}`} style={{ background: boardBg(c) }} title={c} />
                ))}
              </div>
            </div>
            <input autoFocus className="w-full rounded-lg border px-3 py-2" placeholder="Nama board, mis. Website Toko" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Deskripsi (opsional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="block text-sm text-slate-600">
              Tim
              <select value={creating} onChange={(e) => setCreating(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="">Tanpa tim (pribadi)</option>
                {teams.filter((t) => t.role !== "member").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-slate-500">Board baru otomatis berisi list Backlog → To Do → In Progress → Review → Done.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(null)} className="rounded-lg px-4 py-2 hover:bg-slate-100">Batal</button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-500">Buat</button>
            </div>
          </form>
        </Modal>
      )}

      {managing && (
        <TeamModal teamId={managing} user={user} myBoards={boards ?? []} onClose={() => (setManaging(null), router.replace("/boards"))} onChanged={() => void load()} />
      )}
    </div>
  );
}
