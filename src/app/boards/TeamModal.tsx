"use client";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { boardBg } from "@/lib/theme";

type Detail = {
  team: { id: string; name: string; invite_code: string | null; owner_id: string };
  members: { id: string; name: string; email: string; color: string; avatar: string | null; role: string }[];
  boards: { id: string; name: string; color: string }[];
  role: string;
};
type MyBoard = { id: string; name: string; role: string };

// manage a team: members, shared boards, name; changes call onChanged so the page reloads
export function TeamModal({ teamId, user, myBoards, onClose, onChanged }: { teamId: string; user: User; myBoards: MyBoard[]; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"members" | "boards" | "settings">("members");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api<Detail>(`/api/teams/${teamId}`).then((x) => (setD(x), setName(x.team.name))), [teamId]);
  useEffect(() => {
    void load();
  }, [load]);

  // run a change, then refresh this modal and the page behind it
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      alert((e as Error).message);
    }
    await load().catch(() => onClose());
    onChanged();
  }

  if (!d) return null;
  const admin = d.role !== "member";
  const link = d.team.invite_code ? `${window.location.origin}/join/team/${d.team.invite_code}` : "";
  // boards the user can share: ones they administer that are not in the team yet
  const addable = myBoards.filter((b) => b.role !== "member" && !d.boards.some((x) => x.id === b.id));

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-bold">👥 {d.team.name}</h2>
        <button onClick={onClose} className="rounded-full px-2.5 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      <div className="flex gap-1 border-b px-4 text-sm">
        {(["members", "boards", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 ${tab === t ? "border-blue-600 font-semibold text-blue-700" : "border-transparent text-slate-500"}`}>
            {t === "members" ? `Member (${d.members.length})` : t === "boards" ? `Board (${d.boards.length})` : "Pengaturan"}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-4">
        {tab === "members" && (
          <>
            {admin && (
              <>
                <div>
                  <div className="mb-1 text-sm font-semibold">Link undangan tim</div>
                  <p className="mb-2 text-xs text-slate-500">Yang bergabung otomatis bisa membuka semua board tim ini.</p>
                  <div className="flex gap-2">
                    <input readOnly value={link} className="flex-1 rounded-md border bg-slate-50 px-2 py-1.5 text-xs" onFocus={(e) => e.target.select()} />
                    <button onClick={() => navigator.clipboard.writeText(link).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))} className="rounded-md bg-blue-600 px-3 text-sm text-white">
                      {copied ? "Tersalin ✓" : "Salin"}
                    </button>
                  </div>
                  <button onClick={() => confirm("Link lama akan berhenti berlaku. Lanjut?") && run(() => api(`/api/teams/${teamId}/invite`, "POST"))} className="mt-1.5 text-xs text-slate-500 underline">
                    Buat link baru
                  </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); void run(() => api(`/api/teams/${teamId}/members`, "POST", { email })).then(() => setEmail("")); }} className="flex gap-2">
                  <input type="email" required className="flex-1 rounded-md border px-2 py-1.5 text-sm" placeholder="Tambah lewat email user terdaftar" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button className="rounded-md bg-slate-800 px-3 text-sm text-white dark:bg-blue-600">Tambah</button>
                </form>
              </>
            )}
            <div className="divide-y rounded-md border">
              {d.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 p-2">
                  <Avatar name={m.name} color={m.color} src={m.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}{m.id === user.id && " (kamu)"}</div>
                    <div className="truncate text-xs text-slate-500">{m.email}</div>
                  </div>
                  {m.role === "owner" || !admin ? (
                    <span className="text-xs text-slate-500 capitalize">{m.role}</span>
                  ) : (
                    <select value={m.role} onChange={(e) => run(() => api(`/api/teams/${teamId}/members/${m.id}`, "PATCH", { role: e.target.value }))} className="rounded border px-1 py-0.5 text-xs">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {m.role !== "owner" && (admin || m.id === user.id) && (
                    <button
                      title={m.id === user.id ? "Keluar dari tim" : "Keluarkan"}
                      onClick={() => confirm(m.id === user.id ? "Keluar dari tim ini?" : `Keluarkan ${m.name} dari tim?`) && run(() => api(`/api/teams/${teamId}/members/${m.id}`, "DELETE")).then(() => m.id === user.id && onClose())}
                      className="rounded px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "boards" && (
          <>
            <p className="text-xs text-slate-500">Semua member tim bisa membuka board di bawah ini. Satu board boleh masuk ke beberapa tim, dan tetap bisa mengundang orang langsung ke board.</p>
            <div className="divide-y rounded-md border">
              {d.boards.length === 0 && <div className="p-3 text-sm text-slate-400">Belum ada board di tim ini.</div>}
              {d.boards.map((b) => (
                <div key={b.id} className="flex items-center gap-2.5 p-2">
                  <span className="h-6 w-9 rounded" style={{ background: boardBg(b.color) }} />
                  <a href={`/b/${b.id}`} className="flex-1 truncate text-sm font-medium hover:underline">{b.name}</a>
                  {admin && (
                    <button onClick={() => confirm(`Keluarkan "${b.name}" dari tim? Board-nya tidak terhapus.`) && run(() => api(`/api/teams/${teamId}/boards/${b.id}`, "DELETE"))} className="rounded px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {admin && addable.length > 0 && (
              <select value="" onChange={(e) => e.target.value && run(() => api(`/api/teams/${teamId}/boards`, "POST", { boardId: e.target.value }))} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">+ Tambahkan board ke tim…</option>
                {addable.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </>
        )}

        {tab === "settings" && (
          <>
            {admin ? (
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== d.team.name && run(() => api(`/api/teams/${teamId}`, "PATCH", { name }))} placeholder="Nama tim" />
            ) : (
              <p className="text-sm text-slate-500">Hanya admin tim yang bisa mengubah pengaturan.</p>
            )}
            {d.role === "owner" && (
              <button onClick={() => { if (prompt(`Ketik "${d.team.name}" untuk menghapus tim. Board-nya tidak ikut terhapus.`) === d.team.name) void api(`/api/teams/${teamId}`, "DELETE").then(() => (onClose(), onChanged())); }} className="w-full rounded-md bg-red-50 py-2 text-sm text-red-600 hover:bg-red-100">
                Hapus tim
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
