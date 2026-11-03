"use client";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";
import { EPIC_COLORS, PRIORITY_META, TYPE_META } from "@/lib/theme";
import type { Card, CardType, Comment, Priority } from "@/lib/types";
import { cardHelpers, useBoard } from "./context";

export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const { data, mutate, openCard, user } = useBoard();
  const { childrenOf, progress, isDone, keyOf, points } = cardHelpers(data);
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description);
  const [editingDesc, setEditingDesc] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [pts, setPts] = useState(card.points?.toString() ?? "");

  const patch = (p: Record<string, unknown>) => mutate(() => api(`/api/cards/${card.id}`, "PATCH", p));
  const loadComments = useCallback(() => api<Comment[]>(`/api/cards/${card.id}/comments`).then(setComments), [card.id]);

  useEffect(() => {
    setTitle(card.title);
    setDesc(card.description);
    setEditingDesc(false);
    setPts(card.points?.toString() ?? "");
    void loadComments();
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const epics = data.cards.filter((c) => c.type === "epic" && c.id !== card.id);
  const kids = card.type === "epic" ? childrenOf(card.id) : [];
  const prog = progress(card.id);
  const t = TYPE_META[card.type];

  async function sendComment() {
    if (!text.trim()) return;
    await api(`/api/cards/${card.id}/comments`, "POST", { text });
    setText("");
    await loadComments();
    void mutate(async () => {});
  }

  const sel = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";
  const lbl = "mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase";

  return (
    <Modal onClose={onClose} width={820}>
      <div className="h-2 rounded-t-xl" style={{ background: card.type === "epic" ? (card.color ?? t.color) : t.color }} />
      <div className="flex items-start gap-3 p-5 pb-2">
        <span className="mt-1.5 text-lg" style={{ color: t.color }}>{t.icon}</span>
        <div className="flex-1">
          <input className="w-full rounded px-1 py-0.5 text-xl font-bold outline-none focus:ring-2 focus:ring-blue-400" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== card.title && patch({ title })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          <div className="px-1 text-xs text-slate-500">
            <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{keyOf(card)}</span>
            di list <b>{data.lists.find((l) => l.id === card.list_id)?.name}</b>
            {isDone(card) && <span className="ml-2 rounded bg-green-100 px-1.5 text-green-700">✓ selesai</span>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-full px-2.5 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>

      <div className="grid gap-6 p-5 pt-2 md:grid-cols-[1fr_220px]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap gap-4">
            {card.labels.length > 0 && (
              <div>
                <span className={lbl}>Label</span>
                <div className="flex flex-wrap gap-1">
                  {data.labels.filter((l) => card.labels.includes(l.id)).map((l) => (
                    <span key={l.id} className="rounded px-2 py-1 text-xs font-medium" style={{ background: l.color }}>{l.name}</span>
                  ))}
                </div>
              </div>
            )}
            {card.assignees.length > 0 && (
              <div>
                <span className={lbl}>Ditugaskan ke</span>
                <div className="flex gap-1">
                  {data.members.filter((m) => card.assignees.includes(m.id)).map((m) => <Avatar key={m.id} name={m.name} color={m.color} size={30} />)}
                </div>
              </div>
            )}
          </div>

          <div>
            <span className={lbl}>Deskripsi</span>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea autoFocus rows={6} className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Tulis detail, acceptance criteria, catatan…" />
                <div className="flex gap-2">
                  <button className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" onClick={() => { setEditingDesc(false); void patch({ description: desc }); }}>Simpan</button>
                  <button className="rounded px-3 py-1.5 text-sm hover:bg-slate-100" onClick={() => { setEditingDesc(false); setDesc(card.description); }}>Batal</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setEditingDesc(true)} className="min-h-16 cursor-text rounded-md bg-slate-50 p-2.5 text-sm whitespace-pre-wrap hover:bg-slate-100">
                {card.description || <span className="text-slate-400">Klik untuk menambah deskripsi…</span>}
              </div>
            )}
          </div>

          {card.type === "epic" && (
            <div>
              <span className={lbl}>
                Storyline epic ini · {prog.done}/{prog.total} selesai
                {points(kids).total > 0 && ` · ${points(kids).done}/${points(kids).total} poin`}
              </span>
              <div className="mb-2 h-2 overflow-hidden rounded bg-slate-200">
                <div className="h-full" style={{ width: `${prog.pct}%`, background: card.color ?? "#8b5cf6" }} />
              </div>
              <div className="divide-y rounded-md border">
                {kids.length === 0 && <div className="p-2.5 text-sm text-slate-400">Belum ada story. Hubungkan story ke epic ini dari kartunya, atau dari tab Storyline.</div>}
                {kids.map((k) => (
                  <button key={k.id} onClick={() => openCard(k.id)} className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-slate-50">
                    <span style={{ color: TYPE_META[k.type].color }}>{TYPE_META[k.type].icon}</span>
                    <span className="text-xs font-medium text-slate-500">{keyOf(k)}</span>
                    <span className={`flex-1 truncate ${isDone(k) ? "text-slate-400 line-through" : ""}`}>{k.title}</span>
                    <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{data.lists.find((l) => l.id === k.list_id)?.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className={lbl}>Aktivitas & komentar</span>
            <div className="flex gap-2">
              <Avatar name={user.name} color={user.color} size={30} />
              <div className="flex-1 space-y-2">
                <textarea rows={2} className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="Tulis komentar…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendComment(); }} />
                {text && <button onClick={sendComment} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Kirim</button>}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {[...comments].reverse().map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={c.name} color={c.color} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs"><b>{c.name}</b> <span className="text-slate-400">{new Date(c.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                    <div className="mt-0.5 rounded-md bg-white p-2 text-sm whitespace-pre-wrap shadow-sm ring-1 ring-slate-200">{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div>
            <span className={lbl}>Tipe</span>
            <select className={sel} value={card.type} onChange={(e) => patch({ type: e.target.value as CardType, ...(e.target.value === "epic" ? { parent_id: null, color: card.color ?? EPIC_COLORS[0] } : {}) })}>
              {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div>
            <span className={lbl}>Status (list)</span>
            <select className={sel} value={card.list_id} onChange={(e) => patch({ list_id: e.target.value })}>
              {data.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {card.type !== "epic" ? (
            <div>
              <span className={lbl}>Bagian dari epic</span>
              <select className={sel} value={card.parent_id ?? ""} onChange={(e) => patch({ parent_id: e.target.value || null })}>
                <option value="">— tidak ada —</option>
                {epics.map((e) => <option key={e.id} value={e.id}>⚡ {e.title}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <span className={lbl}>Warna epic</span>
              <div className="flex flex-wrap gap-1.5">
                {EPIC_COLORS.map((c) => (
                  <button key={c} onClick={() => patch({ color: c })} className={`h-6 w-6 rounded-full ${card.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
          {card.type !== "epic" && (
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <span className={lbl}>Sprint</span>
                <select className={sel} value={card.sprint_id ?? ""} onChange={(e) => patch({ sprint_id: e.target.value || null })}>
                  <option value="">Backlog</option>
                  {data.sprints
                    .filter((s) => s.status !== "completed" || s.id === card.sprint_id)
                    .map((s) => (
                      <option key={s.id} value={s.id} disabled={s.status === "completed"}>
                        {s.name}
                        {s.status === "active" ? " (aktif)" : s.status === "completed" ? " (selesai)" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <span className={lbl}>Poin</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  className={sel}
                  value={pts}
                  placeholder="–"
                  onChange={(e) => setPts(e.target.value)}
                  onBlur={() => pts !== (card.points?.toString() ?? "") && patch({ points: pts === "" ? null : Number(pts) })}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              </div>
            </div>
          )}
          <div>
            <span className={lbl}>Prioritas</span>
            <select className={sel} value={card.priority} onChange={(e) => patch({ priority: e.target.value as Priority })}>
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            <div>
              <span className={lbl}>Mulai</span>
              <input type="date" className={sel} value={card.start_date ?? ""} onChange={(e) => patch({ start_date: e.target.value || null })} />
            </div>
            <div>
              <span className={lbl}>Deadline</span>
              <input type="date" className={sel} value={card.due_date ?? ""} onChange={(e) => patch({ due_date: e.target.value || null })} />
            </div>
          </div>
          <div>
            <span className={lbl}>Label</span>
            <div className="flex flex-wrap gap-1">
              {data.labels.map((l) => {
                const on = card.labels.includes(l.id);
                return (
                  <button key={l.id} onClick={() => patch({ labels: toggle(card.labels, l.id) })} className={`rounded px-2 py-1 text-xs font-medium ${on ? "ring-2 ring-slate-800" : "opacity-50 hover:opacity-100"}`} style={{ background: l.color }}>
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className={lbl}>Member</span>
            <div className="space-y-1">
              {data.members.map((m) => {
                const on = card.assignees.includes(m.id);
                return (
                  <button key={m.id} onClick={() => patch({ assignees: toggle(card.assignees, m.id) })} className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm ${on ? "bg-blue-50" : "hover:bg-slate-100"}`}>
                    <Avatar name={m.name} color={m.color} size={22} />
                    <span className="flex-1 truncate">{m.name}</span>
                    {on && <span className="text-blue-600">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={() => { if (confirm("Hapus kartu ini?")) { onClose(); void mutate(() => api(`/api/cards/${card.id}`, "DELETE")); } }} className="w-full rounded-md bg-red-50 py-1.5 text-sm text-red-600 hover:bg-red-100">
            Hapus kartu
          </button>
        </aside>
      </div>
    </Modal>
  );
}
