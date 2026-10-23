"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { TopBar } from "@/components/TopBar";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { BOARD_COLORS, boardBg } from "@/lib/theme";

type Row = { id: string; name: string; description: string; color: string; role: string; member_count: number; card_count: number };

export function BoardsClient({ user }: { user: User }) {
  const router = useRouter();
  const [boards, setBoards] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "blue" });
  const [error, setError] = useState("");

  useEffect(() => {
    api<Row[]>("/api/boards").then(setBoards);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { id } = await api<{ id: string }>("/api/boards", "POST", form);
      router.push(`/b/${id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar user={user} />
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <h1 className="mb-1 text-2xl font-bold">Halo, {user.name.split(" ")[0]} 👋</h1>
        <p className="mb-6 text-slate-500">Semua board kamu. Undang member sebanyak apa pun, gratis.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boards?.map((b) => (
            <Link key={b.id} href={`/b/${b.id}`} className="group relative h-32 overflow-hidden rounded-xl p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" style={{ background: boardBg(b.color) }}>
              <div className="text-lg font-bold drop-shadow">{b.name}</div>
              {b.description && <div className="line-clamp-1 text-sm opacity-80">{b.description}</div>}
              <div className="absolute bottom-3 left-4 flex gap-3 text-xs opacity-90">
                <span>👥 {b.member_count}</span>
                <span>🗒️ {b.card_count}</span>
                {b.role !== "member" && <span className="rounded bg-white/25 px-1.5">{b.role}</span>}
              </div>
            </Link>
          ))}
          <button onClick={() => setCreating(true)} className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/60 text-slate-500 hover:border-blue-400 hover:text-blue-600">
            + Buat board baru
          </button>
        </div>
        {boards?.length === 0 && <p className="mt-6 text-slate-500">Belum ada board. Buat yang pertama!</p>}
      </main>

      {creating && (
        <Modal onClose={() => setCreating(false)} width={440}>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-xs text-slate-500">Board baru otomatis berisi list Backlog → To Do → In Progress → Review → Done.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-4 py-2 hover:bg-slate-100">Batal</button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Buat</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
