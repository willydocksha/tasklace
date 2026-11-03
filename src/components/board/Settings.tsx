"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";
import { BOARD_COLORS, boardBg, LABEL_COLORS, labelText } from "@/lib/theme";
import { useBoard } from "./context";

type Tab = "members" | "look" | "labels";

export function Settings({ onClose, initialTab = "members" }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: [Tab, string][] = [["members", "👥 Member"], ["look", "🎨 Tampilan"], ["labels", "🏷️ Label"]];
  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex items-center border-b px-5 pt-4">
        {tabs.map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium ${tab === k ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>{v}</button>
        ))}
        <button onClick={onClose} className="ml-auto pb-2 text-slate-400">✕</button>
      </div>
      <div className="p-5">
        {tab === "members" && <Members />}
        {tab === "look" && <Look onClose={onClose} />}
        {tab === "labels" && <Labels />}
      </div>
    </Modal>
  );
}

function Members() {
  const { data, mutate, isAdmin, user } = useBoard();
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
      {isAdmin && (
        <>
          <div>
            <div className="mb-1 text-sm font-semibold">Link undangan</div>
            <p className="mb-2 text-xs text-slate-500">Siapa pun yang punya link ini bisa bergabung. Tidak ada batas jumlah member.</p>
            <div className="flex gap-2">
              <input readOnly value={link} className="flex-1 rounded-md border bg-slate-50 px-2 py-1.5 text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={copy} className="rounded-md bg-blue-600 px-3 text-sm text-white">{copied ? "Tersalin ✓" : "Salin"}</button>
            </div>
            <button onClick={() => confirm("Link lama akan berhenti berlaku. Lanjut?") && mutate(() => api(`/api/boards/${data.board.id}/invite`, "POST"))} className="mt-1.5 text-xs text-slate-500 underline">
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
                <span className="text-xs text-slate-500 capitalize">{m.role}</span>
              ) : (
                <select value={m.role} onChange={(e) => mutate(() => api(`/api/boards/${data.board.id}/members/${m.id}`, "PATCH", { role: e.target.value }))} className="rounded border px-1 py-0.5 text-xs">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {m.direct && m.role !== "owner" && (isAdmin || m.id === user.id) && (
                <button
                  title={m.id === user.id ? "Keluar dari board" : "Keluarkan"}
                  onClick={() => { if (confirm(m.id === user.id ? "Keluar dari board ini?" : `Keluarkan ${m.name}?`)) void mutate(() => api(`/api/boards/${data.board.id}/members/${m.id}`, "DELETE")).then(() => m.id === user.id && (window.location.href = "/boards")); }}
                  className="rounded px-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >✕</button>
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
      {data.role === "owner" && (
        <button
          onClick={() => { if (prompt(`Ketik "${data.board.name}" untuk menghapus board ini permanen`) === data.board.name) { onClose(); void api(`/api/boards/${data.board.id}`, "DELETE").then(() => (window.location.href = "/boards")); } }}
          className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100"
        >
          Hapus board
        </button>
      )}
    </div>
  );
}

function Labels() {
  const { data, mutate } = useBoard();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
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
            <button onClick={() => confirm(`Hapus label "${l.name}"?`) && mutate(() => api(`/api/labels/${l.id}`, "DELETE"))} className="px-1.5 text-slate-400 hover:text-red-600">✕</button>
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
