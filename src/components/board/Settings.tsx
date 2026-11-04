"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { confirmDialog, promptDialog, toastError } from "@/components/ui/Dialog";
import { api } from "@/lib/client";
import { ROLE_LABEL, type Perms, type Role } from "@/lib/permissions";
import { BOARD_COLORS, boardBg, LABEL_COLORS, labelText } from "@/lib/theme";
import { useBoard } from "./context";

type Tab = "members" | "look" | "labels" | "flow";

export function Settings({ onClose, initialTab = "members" }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: [Tab, string, IconName][] = [["members", "Member", "users"], ["look", "Tampilan", "palette"], ["labels", "Label", "tag"], ["flow", "Alur status", "flow"]];
  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex items-center border-b px-5 pt-4">
        {tabs.map(([k, v, icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium ${tab === k ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}><Icon name={icon} />{v}</button>
        ))}
        <button onClick={onClose} aria-label="Tutup" className="ml-auto pb-2 text-slate-400"><Icon name="x" /></button>
      </div>
      <div className="p-5">
        {tab === "members" && <Members />}
        {tab === "look" && <Look onClose={onClose} />}
        {tab === "labels" && <Labels />}
        {tab === "flow" && <Flow />}
      </div>
    </Modal>
  );
}

// plain-language list of the current user's rights on this board
function MyRights({ role, perms }: { role: string; perms: Perms }) {
  const rows: [boolean, string][] = [
    [perms.createCard, "Membuat kartu baru"],
    [perms.editCard !== "none", perms.editCard === "own" ? "Mengubah & memindah kartu yang kamu buat / ditugaskan ke kamu" : "Mengubah, memindah & menghapus kartu"],
    [perms.structure, "Mengatur list, label & sprint"],
    [perms.comment, "Menulis komentar"],
    [perms.admin, "Mengundang member & mengatur board"],
  ];
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="mb-1.5 font-semibold">Hak akses kamu: {ROLE_LABEL[role as Role] ?? role}</div>
      <ul className="space-y-0.5">
        {rows.map(([ok, label]) => (
          <li key={label} className={`flex items-center gap-1.5 ${ok ? "text-slate-700" : "text-slate-400 line-through"}`}><Icon name={ok ? "check" : "x"} className="h-3.5 w-3.5" />{label}</li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-slate-500">Hak akses lewat tim diatur admin tim di halaman Board saya → Kelola tim → Hak akses.</p>
    </div>
  );
}

function Members() {
  const { data, mutate, isAdmin, user, perms } = useBoard();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/join/${data.board.invite_code}` : "";

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      <MyRights role={data.role} perms={perms} />
      {isAdmin && (
        <>
          <div>
            <div className="mb-1 text-sm font-semibold">Link undangan</div>
            <p className="mb-2 text-xs text-slate-500">Siapa pun yang punya link ini bisa bergabung. Tidak ada batas jumlah member.</p>
            <div className="flex gap-2">
              <input readOnly value={link} className="flex-1 rounded-md border bg-slate-50 px-2 py-1.5 text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={copy} className="rounded-md bg-blue-600 px-3 text-sm text-white">{copied ? "Tersalin" : "Salin"}</button>
            </div>
            <button onClick={async () => (await confirmDialog({ title: "Buat link undangan baru?", message: "Link lama akan berhenti berlaku.", confirmLabel: "Buat link baru" })) && mutate(() => api(`/api/boards/${data.board.id}/invite`, "POST"))} className="mt-1.5 text-xs text-slate-500 underline">
              Buat link baru
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void mutate(() => api(`/api/boards/${data.board.id}/members`, "POST", { email })).then(() => setEmail("")); }} className="flex gap-2">
            <input type="email" required className="flex-1 rounded-md border px-2 py-1.5 text-sm" placeholder="Tambah lewat email user terdaftar" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="rounded-md bg-slate-800 px-3 text-sm text-white dark:bg-blue-600">Tambah</button>
          </form>
        </>
      )}
      <div>
        <div className="mb-2 text-sm font-semibold">{data.members.length} member</div>
        <div className="divide-y rounded-md border">
          {data.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 p-2">
              <Avatar name={m.name} color={m.color} src={m.avatar} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.name}{m.id === user.id && " (kamu)"}</div>
                <div className="truncate text-xs text-slate-500">
                  {m.email}
                  {!m.direct && <span className="ml-1.5 rounded bg-blue-50 px-1 text-blue-700">via tim</span>}
                </div>
              </div>
              {m.role === "owner" || !isAdmin || !m.direct ? (
                <span className="text-xs text-slate-500">{ROLE_LABEL[m.role as Role] ?? m.role}</span>
              ) : (
                <select value={m.role} title="Viewer hanya bisa melihat dan berkomentar" onChange={(e) => mutate(() => api(`/api/boards/${data.board.id}/members/${m.id}`, "PATCH", { role: e.target.value }))} className="rounded border px-1 py-0.5 text-xs">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
              {m.direct && m.role !== "owner" && (isAdmin || m.id === user.id) && (
                <button
                  title={m.id === user.id ? "Keluar dari board" : "Keluarkan"}
                  onClick={async () => { if (await confirmDialog(m.id === user.id ? { title: "Keluar dari board ini?", danger: true, confirmLabel: "Keluar" } : { title: `Keluarkan ${m.name} dari board?`, danger: true, confirmLabel: "Keluarkan" })) void mutate(() => api(`/api/boards/${data.board.id}/members/${m.id}`, "DELETE")).then(() => m.id === user.id && (window.location.href = "/boards")); }}
                  aria-label={m.id === user.id ? "Keluar dari board" : "Keluarkan"}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                ><Icon name="x" /></button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Look({ onClose }: { onClose: () => void }) {
  const { data, mutate, isAdmin } = useBoard();
  const [name, setName] = useState(data.board.name);
  const [desc, setDesc] = useState(data.board.description);
  const [key, setKey] = useState(data.board.key);
  const patch = (p: Record<string, string>) => mutate(() => api(`/api/boards/${data.board.id}`, "PATCH", p));
  if (!isAdmin) return <p className="text-sm text-slate-500">Hanya admin board yang bisa mengubah tampilan.</p>;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-sm font-semibold">Warna board</div>
        <div className="grid grid-cols-6 gap-2">
          {Object.keys(BOARD_COLORS).map((c) => (
            <button key={c} onClick={() => patch({ color: c })} title={c} className={`h-12 rounded-lg ${data.board.color === c ? "ring-2 ring-blue-600 ring-offset-2" : ""}`} style={{ background: boardBg(c) }} />
          ))}
        </div>
      </div>
      <input className="w-full rounded-md border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== data.board.name && patch({ name })} placeholder="Nama board" />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Kode issue
        <input
          className="w-28 rounded-md border px-2 py-1.5 font-mono text-sm uppercase"
          value={key}
          maxLength={10}
          onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          onBlur={() => key !== data.board.key && patch({ key })}
        />
        <span className="text-xs text-slate-400">contoh: {key || "TLC"}-12</span>
      </label>
      <textarea rows={2} className="w-full rounded-md border px-3 py-2 text-sm" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== data.board.description && patch({ description: desc })} placeholder="Deskripsi board" />
      <Duplicate />
      {data.role === "owner" && (
        <button
          onClick={async () => { if ((await promptDialog({ title: "Hapus board permanen?", message: <>Semua list, kartu, dan komentar ikut terhapus. Ketik <b>{data.board.name}</b> untuk konfirmasi.</>, match: data.board.name, danger: true, confirmLabel: "Hapus board" })) === data.board.name) { onClose(); void api(`/api/boards/${data.board.id}`, "DELETE").then(() => (window.location.href = "/boards")); } }}
          className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100"
        >
          Hapus board
        </button>
      )}
    </div>
  );
}

// copy this board into a new one, with or without its cards
function Duplicate() {
  const { data } = useBoard();
  const [name, setName] = useState(`${data.board.name} (salinan)`);
  const [withCards, setWithCards] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>(`/api/boards/${data.board.id}/duplicate`, "POST", { name, withCards });
      window.location.href = `/b/${id}`;
    } catch (e) {
      toastError(e);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="copy" className="h-4 w-4 text-slate-500" />Duplikat board</div>
      <p className="text-xs text-slate-500">Board baru akan punya list, urutan, warna list, alur status, label dan warna board yang sama. Member tidak ikut disalin.</p>
      <input className="w-full rounded-md border px-2 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama board baru" />
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" checked={!withCards} onChange={() => setWithCards(false)} /> Tanpa kartu</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={withCards} onChange={() => setWithCards(true)} /> Dengan kartu ({data.cards.length})</label>
      </div>
      {withCards && <p className="text-xs text-slate-500">Kartu, epic, sprint, label kartu dan lampiran ikut disalin. Komentar dan riwayat tidak ikut; assignee hanya kamu.</p>}
      <button disabled={busy || !name.trim()} onClick={run} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-blue-600">
        {busy ? "Menyalin…" : "Duplikat"}
      </button>
    </div>
  );
}

function Labels() {
  const { data, mutate, perms } = useBoard();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
  if (!perms.structure) return <p className="text-sm text-slate-500">Kamu tidak punya izin mengatur label di board ini.</p>;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {data.labels.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <span className="flex-1 rounded px-2.5 py-1.5 text-sm font-medium" style={{ background: l.color, color: labelText(l.color) }}>{l.name}</span>
            <div className="flex gap-0.5">
              {LABEL_COLORS.slice(0, 6).map((c) => (
                <button key={c} onClick={() => mutate(() => api(`/api/labels/${l.id}`, "PATCH", { color: c }))} className="h-4 w-4 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <button onClick={async () => (await confirmDialog({ title: `Hapus label "${l.name}"?`, message: "Label akan dilepas dari semua kartu.", danger: true })) && mutate(() => api(`/api/labels/${l.id}`, "DELETE"))} aria-label="Hapus label" className="px-1.5 text-slate-400 hover:text-red-600"><Icon name="x" /></button>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) void mutate(() => api(`/api/boards/${data.board.id}/labels`, "POST", { name, color })).then(() => setName("")); }} className="space-y-2 rounded-md bg-slate-50 p-3">
        <div className="flex gap-1.5">
          {LABEL_COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded ${color === c ? "ring-2 ring-slate-800 ring-offset-1" : ""}`} style={{ background: c }} />
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 rounded-md border px-2 py-1.5 text-sm" placeholder="Nama label baru" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="rounded-md bg-blue-600 px-3 text-sm text-white">Tambah</button>
        </div>
      </form>
    </div>
  );
}

// status flow editor: per list, which lists a card may move to next
function Flow() {
  const { data, mutate, isAdmin } = useBoard();
  const lists = [...data.lists].sort((a, b) => a.position - b.position);
  const setNext = (listId: string, next: string[] | null) => mutate(() => api(`/api/lists/${listId}`, "PATCH", { next_ids: next }));

  // toggle one target; the first pick turns a free list into a restricted one
  function toggle(listId: string, cur: string[] | null, target: string) {
    const base = cur ?? [];
    void setNext(listId, base.includes(target) ? base.filter((x) => x !== target) : [...base, target]);
  }

  // preset: each list only goes to the next one; the last list stays free
  async function sequential() {
    if (!(await confirmDialog({ title: "Atur alur berurutan?", message: "Alur mengikuti urutan list. Aturan yang ada akan diganti.", confirmLabel: "Terapkan" }))) return;
    await mutate(() => Promise.all(lists.map((l, i) => api(`/api/lists/${l.id}`, "PATCH", { next_ids: i < lists.length - 1 ? [lists[i + 1].id] : null }))));
  }

  // preset: remove every rule
  async function reset() {
    if (!(await confirmDialog({ title: "Hapus semua aturan alur?", message: "Kartu bisa dipindah bebas lagi.", danger: true }))) return;
    await mutate(() => Promise.all(lists.filter((l) => l.next_ids).map((l) => api(`/api/lists/${l.id}`, "PATCH", { next_ids: null }))));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Tentukan dari setiap list, kartu boleh pindah ke list mana saja. List yang <b>bebas</b> boleh pindah ke mana pun.
        {!isAdmin && " Hanya admin board yang bisa mengubah alur."}
      </p>
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button onClick={sequential} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"><Icon name="arrow-right" />Isi alur berurutan</button>
          <button onClick={reset} className="rounded-md border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Bebaskan semua</button>
        </div>
      )}
      <div className="scroll-thin max-h-[50vh] space-y-2 overflow-y-auto">
        {lists.map((l) => (
          <div key={l.id} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color ?? "#94a3b8" }} />
              <b className="text-sm">{l.name}</b>
              <span className="text-xs text-slate-400">boleh ke</span>
              {isAdmin ? (
                <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" checked={!l.next_ids} onChange={(e) => setNext(l.id, e.target.checked ? null : [])} />
                  Bebas
                </label>
              ) : (
                !l.next_ids && <span className="ml-auto text-xs text-slate-500">Bebas</span>
              )}
            </div>
            {l.next_ids && (
              <div className="flex flex-wrap gap-1.5">
                {lists.filter((t) => t.id !== l.id).map((t) => {
                  const on = l.next_ids!.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      disabled={!isAdmin}
                      onClick={() => toggle(l.id, l.next_ids, t.id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-blue-600 bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"} disabled:cursor-default`}
                    >
                      {on && <Icon name="check" className="h-3 w-3" />}{t.name}
                    </button>
                  );
                })}
                {!l.next_ids.length && <span className="text-xs text-amber-600">Kartu di list ini tidak bisa dipindah.</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
