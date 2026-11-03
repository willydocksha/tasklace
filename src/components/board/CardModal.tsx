"use client";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { RichText } from "@/components/RichText";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/client";
import { EPIC_COLORS, PRIORITY_META, TYPE_META, labelText } from "@/lib/theme";
import type { Activity, Card, CardType, Comment, Priority } from "@/lib/types";
import { ActivityFeed } from "./ActivityFeed";
import { StatusJourney } from "./StatusJourney";
import { cardHelpers, useBoard } from "./context";

export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const { data, mutate, openCard, user } = useBoard();
  const { childrenOf, progress, isDone, keyOf, points } = cardHelpers(data);
  const [title, setTitle] = useState(card.title);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  const patch = (p: Record<string, unknown>) => mutate(() => api(`/api/cards/${card.id}`, "PATCH", p));
  const loadComments = useCallback(() => api<Comment[]>(`/api/cards/${card.id}/comments`).then(setComments), [card.id]);
  const loadActivity = useCallback(() => api<Activity[]>(`/api/cards/${card.id}/activity`).then(setActivity), [card.id]);

  useEffect(() => {
    setTitle(card.title);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // the card object changes after every save or realtime refresh: reload its history
  useEffect(() => {
    void loadComments();
    void loadActivity();
  }, [card, loadComments, loadActivity]);

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const epics = data.cards.filter((c) => c.type === "epic" && c.id !== card.id);
  const kids = card.type === "epic" ? childrenOf(card.id) : [];
  const prog = progress(card.id);
  const t = TYPE_META[card.type];
  // done cards are read-only except for their status
  const locked = isDone(card);
  const doneLists = new Set(data.lists.filter((l) => l.is_done).map((l) => l.id));

  async function sendComment(text: string) {
    await api(`/api/cards/${card.id}/comments`, "POST", { text });
    await loadComments();
    void mutate(async () => {});
  }

  const lbl = "mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase";

  return (
    <Modal onClose={onClose} width={820}>
      <div className="h-2 rounded-t-xl" style={{ background: card.type === "epic" ? (card.color ?? t.color) : t.color }} />
      <div className="flex items-start gap-3 p-5 pb-2">
        <span className="mt-1.5 text-lg" style={{ color: t.color }}>{t.icon}</span>
        <div className="flex-1">
          <input readOnly={locked} className="w-full rounded px-1 py-0.5 text-xl font-bold outline-none read-only:cursor-default focus:ring-2 focus:ring-blue-400 read-only:focus:ring-0" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== card.title && patch({ title })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          <div className="px-1 text-xs text-slate-500">
            <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{keyOf(card)}</span>
            di list <b>{data.lists.find((l) => l.id === card.list_id)?.name}</b>
            {isDone(card) && <span className="ml-2 rounded bg-green-100 px-1.5 text-green-700">✓ selesai</span>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-full px-2.5 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>

      {locked && (
        <div className="mx-5 mb-1 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 ring-1 ring-green-200">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>
          <span>Kartu ini sudah <b>selesai</b> dan dikunci. Ubah <b>Status</b> untuk membukanya lagi. Komentar tetap bisa ditambahkan.</span>
        </div>
      )}
      <div className="grid gap-6 p-5 pt-2 md:grid-cols-[1fr_250px]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap gap-4">
            {card.labels.length > 0 && (
              <div>
                <span className={lbl}>Label</span>
                <div className="flex flex-wrap gap-1">
                  {data.labels.filter((l) => card.labels.includes(l.id)).map((l) => (
                    <span key={l.id} className="rounded px-2 py-1 text-xs font-medium" style={{ background: l.color, color: labelText(l.color) }}>{l.name}</span>
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
            <RichText key={card.id} readOnly={locked} value={card.description} onSave={(md) => void patch({ description: md })} placeholder="Tulis detail, acceptance criteria, catatan…" />
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
            <span className={lbl}>Perjalanan status</span>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <StatusJourney card={card} lists={data.lists} activity={activity} />
            </div>
          </div>

          <ActivityFeed activity={activity} comments={comments} user={user} doneLists={doneLists} onComment={sendComment} />
        </div>

        <aside className="space-y-3.5 self-start rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
          <Field label="Tipe">
            <Select
              disabled={locked}
              value={card.type}
              options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k as CardType, label: v.label, icon: <TypeIcon color={v.color} icon={v.icon} /> }))}
              onChange={(v) => patch({ type: v, ...(v === "epic" ? { parent_id: null, color: card.color ?? EPIC_COLORS[0] } : {}) })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={card.list_id}
              options={data.lists.map((l) => ({ value: l.id, label: l.name, icon: <StatusDot done={!!l.is_done} />, hint: l.is_done ? <span className="text-[11px] text-green-600">selesai</span> : undefined }))}
              onChange={(v) => patch({ list_id: v })}
            />
          </Field>
          {card.type !== "epic" ? (
            <Field label="Bagian dari epic">
              <Select
                disabled={locked}
                value={card.parent_id ?? ""}
                searchable={epics.length > 6}
                placeholder="Tidak ada"
                options={[
                  { value: "", label: "Tidak ada", icon: <span className="text-slate-300">—</span> },
                  ...epics.map((e) => ({ value: e.id, label: e.title, description: keyOf(e), icon: <span className="block h-2.5 w-2.5 rounded-sm" style={{ background: e.color ?? TYPE_META.epic.color }} /> })),
                ]}
                onChange={(v) => patch({ parent_id: v || null })}
              />
            </Field>
          ) : (
            <Field label="Warna epic">
              <div className="flex flex-wrap gap-1.5">
                {EPIC_COLORS.map((c) => (
                  <button key={c} disabled={locked} onClick={() => patch({ color: c })} className={`h-6 w-6 rounded-full transition hover:scale-110 ${card.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </Field>
          )}
          {card.type !== "epic" && (
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label="Sprint">
                <Select
                  disabled={locked}
                  value={card.sprint_id ?? ""}
                  options={[
                    { value: "", label: "Backlog", icon: <span className="text-slate-400">☰</span> },
                    ...data.sprints
                      .filter((s) => s.status !== "completed" || s.id === card.sprint_id)
                      .map((s) => ({
                        value: s.id,
                        label: s.name,
                        disabled: s.status === "completed",
                        icon: <span className={`block h-2 w-2 rounded-full ${s.status === "active" ? "bg-green-500" : "bg-slate-300"}`} />,
                        hint: s.status === "active" ? <span className="text-[11px] font-medium text-green-600">aktif</span> : s.status === "completed" ? <span className="text-[11px]">selesai</span> : undefined,
                      })),
                  ]}
                  onChange={(v) => patch({ sprint_id: v || null })}
                />
              </Field>
              <Field label="Poin">
                <Stepper disabled={locked} value={card.points} onChange={(v) => patch({ points: v })} />
              </Field>
            </div>
          )}
          <Field label="Prioritas">
            <Select
              disabled={locked}
              value={card.priority}
              options={Object.entries(PRIORITY_META).map(([k, v]) => ({ value: k as Priority, label: v.label, icon: <PriorityIcon level={k as Priority} color={v.color} /> }))}
              onChange={(v) => patch({ priority: v })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            <Field label="Mulai">
              <DatePicker disabled={locked} value={card.start_date} onChange={(v) => patch({ start_date: v })} placeholder="Belum diatur" />
            </Field>
            <Field label="Deadline">
              <DatePicker disabled={locked} value={card.due_date} onChange={(v) => patch({ due_date: v })} placeholder="Belum diatur" deadline min={card.start_date} />
            </Field>
          </div>
          <Field label="Label">
            <div className="flex flex-wrap gap-1.5">
              {data.labels.map((l) => {
                const on = card.labels.includes(l.id);
                return (
                  <button
                    key={l.id}
                    disabled={locked}
                    onClick={() => patch({ labels: toggle(card.labels, l.id) })}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:pointer-events-none ${on ? "shadow-sm ring-2 ring-white ring-offset-1 ring-offset-slate-400" : "opacity-45 saturate-50 hover:opacity-90 hover:saturate-100"}`}
                    style={{ background: l.color, color: labelText(l.color) }}
                  >
                    {on && <span>✓</span>}
                    {l.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Member">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {data.members.map((m) => {
                const on = card.assignees.includes(m.id);
                return (
                  <button key={m.id} disabled={locked} onClick={() => patch({ assignees: toggle(card.assignees, m.id) })} className={`flex w-full items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-left text-sm transition last:border-0 disabled:pointer-events-none ${on ? "bg-blue-50/70" : "hover:bg-slate-50"}`}>
                    <Avatar name={m.name} color={m.color} size={22} />
                    <span className="flex-1 truncate">{m.name}</span>
                    <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{on && "✓"}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          {!locked && <button onClick={() => { if (confirm("Hapus kartu ini?")) { onClose(); void mutate(() => api(`/api/cards/${card.id}`, "DELETE")); } }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-white py-2 text-sm font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h12M8 6V4.5h4V6m-6 0 .7 10h6.6L14 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Hapus kartu
          </button>}
        </aside>
      </div>
    </Modal>
  );
}

// sidebar field: small caps label above a control
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
      {children}
    </div>
  );
}

// issue type badge: emoji on a tinted square
function TypeIcon({ color, icon }: { color: string; icon: string }) {
  return <span className="flex h-5 w-5 items-center justify-center rounded text-[11px]" style={{ background: `${color}22`, color }}>{icon}</span>;
}

// list status dot: green when the list counts as done
function StatusDot({ done }: { done: boolean }) {
  return <span className={`block h-2.5 w-2.5 rounded-full ring-2 ${done ? "bg-green-500 ring-green-100" : "bg-slate-400 ring-slate-100"}`} />;
}

// jira-like priority chevrons
function PriorityIcon({ level, color }: { level: Priority; color: string }) {
  const paths: Record<Priority, string> = {
    low: "M4 7l4 4 4-4",
    medium: "M4 6h8M4 10h8",
    high: "M4 9l4-4 4 4",
    urgent: "M4 8l4-4 4 4M4 12l4-4 4 4",
  };
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[level]} />
    </svg>
  );
}

// story points: -/+ buttons around a small number input
function Stepper({ value, onChange, disabled = false }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState(value?.toString() ?? "");
  useEffect(() => setTxt(value?.toString() ?? ""), [value]);
  // commit typed text: empty clears, otherwise clamp 0..999
  const commit = (t: string) => {
    const v = t.trim() === "" ? null : Math.max(0, Math.min(999, Math.round(Number(t)) || 0));
    if (v !== value) onChange(v);
    else setTxt(value?.toString() ?? "");
  };
  const bump = (d: number) => onChange(Math.max(0, Math.min(999, (value ?? 0) + d)));
  const btn = "flex w-7 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30";
  return (
    <div className={`flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-within:border-blue-400 focus-within:ring-3 focus-within:ring-blue-100 ${disabled ? "pointer-events-none opacity-60 shadow-none" : ""}`}>
      <button type="button" className={btn} onClick={() => bump(-1)} disabled={disabled || !value} aria-label="Kurangi poin">−</button>
      <input
        disabled={disabled}
        inputMode="numeric"
        className="w-0 flex-1 text-center text-sm font-medium outline-none placeholder:text-slate-300"
        value={txt}
        placeholder="–"
        onChange={(e) => setTxt(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => commit(txt)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" className={btn} onClick={() => bump(1)} disabled={disabled} aria-label="Tambah poin">+</button>
    </div>
  );
}
