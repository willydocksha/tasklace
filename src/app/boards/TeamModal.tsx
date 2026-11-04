"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { PhotoCropper } from "@/components/PhotoCropper";
import { TeamAvatar } from "@/components/TeamAvatar";
import { confirmDialog, promptDialog, toastError } from "@/components/ui/Dialog";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client";
import { isAdminRole, ROLE_LABEL, type Role, type TeamPolicy } from "@/lib/permissions";
import { boardBg } from "@/lib/theme";

type Detail = {
  team: { id: string; name: string; avatar: string | null; invite_code: string | null; owner_id: string };
  members: { id: string; name: string; email: string; color: string; avatar: string | null; role: string }[];
  boards: { id: string; name: string; color: string }[];
  policy: TeamPolicy;
  role: string;
};
type MyBoard = { id: string; name: string; role: string };

// manage a team: members, shared boards, name; changes call onChanged so the page reloads
export function TeamModal({ teamId, user, myBoards, onClose, onChanged }: { teamId: string; user: User; myBoards: MyBoard[]; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"members" | "boards" | "access" | "settings">("members");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api<Detail>(`/api/teams/${teamId}`).then((x) => (setD(x), setName(x.team.name))), [teamId]);
  useEffect(() => {
    void load();
  }, [load]);

  // run a change, then refresh this modal and the page behind it
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      toastError(e);
    }
    await load().catch(() => onClose());
    onChanged();
  }

  // upload a cropped photo; errors show in an alert like the other team actions
  async function uploadPhoto(blob: Blob) {
    await run(async () => {
      const res = await fetch(`/api/teams/${teamId}/avatar`, { method: "PUT", headers: { "content-type": blob.type }, body: blob });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Gagal mengunggah foto");
    });
    setCropFile(null);
  }

  if (!d) return null;
  const admin = isAdminRole(d.role);
  const link = d.team.invite_code ? `${window.location.origin}/join/team/${d.team.invite_code}` : "";
  // boards the user can share: ones they administer that are not in the team yet
  const addable = myBoards.filter((b) => isAdminRole(b.role) && !d.boards.some((x) => x.id === b.id));

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-bold">
          <TeamAvatar name={d.team.name} src={d.team.avatar} size={32} />
          <span className="truncate">{d.team.name}</span>
        </h2>
        <button onClick={onClose} className="rounded-full px-2.5 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      <div className="flex gap-1 border-b px-4 text-sm">
        {(["members", "boards", "access", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 ${tab === t ? "border-blue-600 font-semibold text-blue-700" : "border-transparent text-slate-500"}`}>
            {t === "members" ? `Member (${d.members.length})` : t === "boards" ? `Board (${d.boards.length})` : t === "access" ? "Hak akses" : "Pengaturan"}
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
                  <button onClick={async () => (await confirmDialog({ title: "Buat link undangan baru?", message: "Link lama akan berhenti berlaku.", confirmLabel: "Buat link baru" })) && run(() => api(`/api/teams/${teamId}/invite`, "POST"))} className="mt-1.5 text-xs text-slate-500 underline">
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
                    <span className="text-xs text-slate-500">{ROLE_LABEL[m.role as Role] ?? m.role}</span>
                  ) : (
                    <select value={m.role} title="Lihat tab Hak akses untuk arti tiap peran" onChange={(e) => run(() => api(`/api/teams/${teamId}/members/${m.id}`, "PATCH", { role: e.target.value }))} className="rounded border px-1 py-0.5 text-xs">
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  {m.role !== "owner" && (admin || m.id === user.id) && (
                    <button
                      title={m.id === user.id ? "Keluar dari tim" : "Keluarkan"}
                      onClick={async () => (await confirmDialog(m.id === user.id ? { title: "Keluar dari tim ini?", danger: true, confirmLabel: "Keluar" } : { title: `Keluarkan ${m.name} dari tim?`, danger: true, confirmLabel: "Keluarkan" })) && run(() => api(`/api/teams/${teamId}/members/${m.id}`, "DELETE")).then(() => m.id === user.id && onClose())}
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
                    <button onClick={async () => (await confirmDialog({ title: `Keluarkan "${b.name}" dari tim?`, message: "Board-nya tidak terhapus.", confirmLabel: "Keluarkan" })) && run(() => api(`/api/teams/${teamId}/boards/${b.id}`, "DELETE"))} className="rounded px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
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

        {tab === "access" && <Access policy={d.policy} admin={admin} onChange={(p) => run(() => api(`/api/teams/${teamId}`, "PATCH", { policy: p }))} />}

        {tab === "settings" && (
          <>
            {admin && (
              <div className="flex items-center gap-3">
                <TeamAvatar name={d.team.name} src={d.team.avatar} size={56} />
                <div className="flex gap-2 text-sm">
                  <button onClick={() => fileRef.current?.click()} className="rounded-md border px-3 py-1.5 hover:bg-slate-50">{d.team.avatar ? "Ganti foto" : "Unggah foto"}</button>
                  {d.team.avatar && (
                    <button onClick={() => run(() => api(`/api/teams/${teamId}/avatar`, "DELETE"))} className="rounded-md px-3 py-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">Hapus</button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCropFile(f); }} />
              </div>
            )}
            {admin ? (
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== d.team.name && run(() => api(`/api/teams/${teamId}`, "PATCH", { name }))} placeholder="Nama tim" />
            ) : (
              <p className="text-sm text-slate-500">Hanya admin tim yang bisa mengubah pengaturan.</p>
            )}
            {d.role === "owner" && (
              <button onClick={async () => { if ((await promptDialog({ title: "Hapus tim?", message: <>Board-nya tidak ikut terhapus. Ketik <b>{d.team.name}</b> untuk konfirmasi.</>, match: d.team.name, danger: true, confirmLabel: "Hapus tim" })) === d.team.name) void api(`/api/teams/${teamId}`, "DELETE").then(() => (onClose(), onChanged())); }} className="w-full rounded-md bg-red-50 py-2 text-sm text-red-600 hover:bg-red-100">
                Hapus tim
              </button>
            )}
          </>
        )}
      </div>
      {/* crop then upload a new team photo */}
      {cropFile && <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={uploadPhoto} />}
    </Modal>
  );
}

// one policy row: a question and the allowed answers
function PolicyRow<K extends keyof TeamPolicy>({ label, hint, value, options, disabled, onChange }: {
  label: string;
  hint: string;
  value: TeamPolicy[K];
  options: [TeamPolicy[K], string][];
  disabled: boolean;
  onChange: (v: TeamPolicy[K]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
      <select disabled={disabled} value={String(value)} onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])} className="rounded-md border px-2 py-1 text-sm disabled:opacity-70">
        {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </select>
    </div>
  );
}

// roles explained + the team's permission policy (editable by admins)
function Access({ policy, admin, onChange }: { policy: TeamPolicy; admin: boolean; onChange: (p: Partial<TeamPolicy>) => void }) {
  const roles: [string, string][] = [
    ["Owner", "Pembuat tim. Bisa semua hal, termasuk menghapus tim."],
    ["Admin", "Mengundang & mengeluarkan member, mengatur peran dan hak akses, membuat board, mengubah semua kartu."],
    ["Member", "Mengerjakan kartu sesuai aturan di bawah."],
    ["Viewer", "Hanya melihat board dan kartu (dan berkomentar kalau diizinkan). Cocok untuk klien atau atasan."],
  ];
  return (
    <>
      <div className="divide-y rounded-md border text-sm">
        {roles.map(([r, d]) => (
          <div key={r} className="flex gap-3 p-2.5">
            <span className="w-16 shrink-0 font-semibold">{r}</span>
            <span className="text-slate-600">{d}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold">Aturan untuk Member & Viewer</div>
        <p className="mb-2 text-xs text-slate-500">{admin ? "Berlaku untuk semua board di tim ini. Owner dan admin selalu bisa semuanya." : "Hanya admin tim yang bisa mengubah aturan ini."}</p>
        <div className="divide-y rounded-md border">
          <PolicyRow<"createBoard"> label="Siapa yang bisa membuat board" hint="Board baru otomatis masuk ke tim ini" value={policy.createBoard} disabled={!admin} onChange={(v) => onChange({ createBoard: v })} options={[["admin", "Admin saja"], ["member", "Admin & member"]]} />
          <PolicyRow<"createCard"> label="Siapa yang bisa membuat kartu" hint="Kartu, epic, story, task, bug" value={policy.createCard} disabled={!admin} onChange={(v) => onChange({ createCard: v })} options={[["member", "Admin & member"], ["admin", "Admin saja"]]} />
          <PolicyRow<"editCard"> label="Siapa yang bisa mengubah kartu" hint="Termasuk memindah status, subtask, lampiran, hapus" value={policy.editCard} disabled={!admin} onChange={(v) => onChange({ editCard: v })} options={[["member", "Admin & semua member"], ["own", "Member: kartu sendiri / yang ditugaskan"], ["admin", "Admin saja"]]} />
          <PolicyRow<"manageBoard"> label="Siapa yang bisa mengatur list, label & sprint" hint="Tambah/ubah kolom, label, sprint" value={policy.manageBoard} disabled={!admin} onChange={(v) => onChange({ manageBoard: v })} options={[["member", "Admin & member"], ["admin", "Admin saja"]]} />
          <PolicyRow<"viewerComment"> label="Viewer boleh berkomentar" hint="Kalau tidak, viewer benar-benar hanya melihat" value={policy.viewerComment} disabled={!admin} onChange={(v) => onChange({ viewerComment: v })} options={[[true, "Boleh"], [false, "Tidak"]]} />
        </div>
      </div>
    </>
  );
}
