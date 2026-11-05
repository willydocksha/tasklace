"use client";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { RichText } from "@/components/RichText";
import { Tour, type TourStep } from "@/components/Tour";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { confirmDialog, promptDialog } from "@/components/ui/Dialog";
import { api } from "@/lib/client";
import { canMove } from "@/lib/flow";
import { uploadCardImage } from "@/lib/image";
import { EPIC_COLORS, PRIORITY_META, TYPE_META, labelText } from "@/lib/theme";
import type { Activity, Card, CardType, Comment, Priority } from "@/lib/types";
import { ActivityFeed } from "./ActivityFeed";
import { AssigneePicker } from "./AssigneePicker";
import { NextStatus } from "./NextStatus";
import { Attachments } from "./Attachments";
import { StatusJourney } from "./StatusJourney";
import { Subtasks } from "./Subtasks";
import { cardHelpers, useBoard } from "./context";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ScrollArea } from "@/components/ui/ScrollArea";

// first-time walkthrough of the card detail
const TOUR: TourStep[] = [
  { target: "card-title", title: "Detail kartu", body: "Ini judul dan kode kartu (mis. WEB-12). Klik judul untuk mengubahnya. Tombol Bagikan menyalin link langsung ke kartu ini." },
  { target: "card-desc", title: "Deskripsi", body: "Tulis detail tugas, acceptance criteria, atau catatan. Bisa pakai heading, list, checklist, blok kode, dan tempel gambar langsung (Ctrl/⌘+V)." },
  { target: "card-subtasks", title: "Subtask", body: "Pecah tugas jadi bagian kecil (mis. Backend, Frontend). Tiap subtask punya status dan penanggung jawab sendiri, dan progresnya terlihat di kartu." },
  { target: "card-attachments", title: "Lampiran", body: "Upload screenshot atau gambar pendukung. Klik gambar untuk melihat ukuran penuh." },
  { target: "card-status", title: "Status", body: "Pindahkan kartu ke tahap berikutnya dari sini (sama seperti menggeser di board). Kalau admin mengatur alur status, hanya tahap yang diizinkan yang muncul. Kartu di list \"selesai\" otomatis dikunci." },
  { target: "card-assignees", title: "Siapa yang mengerjakan", body: "Tugaskan kartu ke satu orang atau lebih. Mereka bisa menyaring \"Tugas saya\" untuk melihat semua kerjaannya." },
  { target: "card-fields", placement: "left", title: "Info lain", body: "Atur tipe, epic induk, sprint, story point (perkiraan besar pekerjaan), prioritas, tanggal mulai dan deadline, serta label." },
  { target: "card-activity", placement: "top", title: "Komentar & riwayat", body: "Diskusi dengan tim lewat komentar. Semua perubahan (status, assignee, deadline, dll) tercatat otomatis, dan tab Perjalanan Status menunjukkan berapa lama kartu di tiap tahap." },
];

export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const { data, mutate, openCard, user, perms, canEdit, isOnline } = useBoard();
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
  // done cards are read-only except for their status; without edit rights everything is
  const editable = canEdit(card);
  const doneLock = isDone(card);
  const locked = doneLock || !editable;
  const doneLists = new Set(data.lists.filter((l) => l.is_done).map((l) => l.id));

  async function sendComment(text: string) {
    await api(`/api/cards/${card.id}/comments`, "POST", { text });
    await loadComments();
    void mutate(async () => {});
  }

  // refresh the board (tile counts) and tell other viewers
  const refreshBoard = useCallback(() => void mutate(async () => {}), [mutate]);

  // description images are stored as card attachments
  async function uploadImage(f: File) {
    const id = await uploadCardImage(card.id, f);
    refreshBoard();
    return `/api/attachments/${id}`;
  }

  const lbl = "mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase";

  return (
    <Modal onClose={onClose} width={1120} floating sizeKey="card">
      {/* full-height column on wide screens: fixed header, columns scroll on their own */}
      <div className="flex flex-col md:h-full">
      {/* header doubles as the drag handle */}
      <div data-drag-handle className="sticky top-0 z-10 shrink-0 cursor-move rounded-t-xl bg-surface md:static">
      <div className="flex items-start gap-3 p-5 pb-3">
        <span className="mt-2" style={{ color: t.color }}><Icon name={t.icon} className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1" data-tour="card-title">
          {/* sized to its text so the rest of the header stays draggable */}
          <input readOnly={locked} className="field-sizing-content -ml-0.5 block max-w-full min-w-24 cursor-text rounded-md px-1.5 py-0.5 text-xl font-bold transition outline-none hover:bg-slate-100 focus:bg-surface focus:ring-2 focus:ring-blue-400 read-only:cursor-default read-only:hover:bg-transparent read-only:focus:ring-0" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== card.title && patch({ title })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          <div className="mt-1.5 px-1 text-xs text-slate-500">
            <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{keyOf(card)}</span>
            di list <b>{data.lists.find((l) => l.id === card.list_id)?.name}</b>
            {isDone(card) && <span className="ml-2 inline-flex items-center gap-1 rounded bg-green-100 px-1.5 text-green-700"><Icon name="check" className="h-3 w-3" />selesai</span>}
          </div>
        </div>
        <ShareButton url={`${typeof window !== "undefined" ? window.location.origin : ""}/b/${data.board.id}?card=${keyOf(card)}`} />
        <button onClick={onClose} aria-label="Tutup" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><Icon name="x" /></button>
      </div>
      </div>

      {!editable && (
        <div className="mx-5 mb-1 flex shrink-0 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 border border-slate-200">
          <Icon name="eye" className="h-4 w-4 text-slate-500" />
          <span>
            Kamu hanya bisa <b>melihat</b> kartu ini
            {perms.editCard === "own" ? ": di board ini kamu cuma bisa mengubah kartu yang kamu buat atau ditugaskan ke kamu." : "."}
            {perms.comment && " Komentar tetap bisa ditambahkan."}
          </span>
        </div>
      )}
      {editable && doneLock && (
        <div className="mx-5 mb-1 flex shrink-0 items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 border border-green-200">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>
          <span>Kartu ini sudah <b>selesai</b> dan dikunci. Ubah <b>Status</b> untuk membukanya lagi. Komentar tetap bisa ditambahkan.</span>
        </div>
      )}
      {/* body: main content and the fields sidebar each scroll inside the modal */}
      <div className="grid gap-6 p-5 pt-2 md:min-h-0 md:flex-1 md:grid-cols-[1fr_300px] md:gap-4 md:pr-3 md:pb-3">
        <ScrollArea wrapperClassName="min-w-0 md:-mr-1 md:min-h-0" className="scroll-soft md:h-full md:overflow-y-auto md:pr-3 md:pb-2" innerClassName="space-y-5">

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
                <span className={lbl}>Assignees</span>
                <div className="flex gap-1">
                  {data.members.filter((m) => card.assignees.includes(m.id)).map((m) => <Avatar key={m.id} name={m.name} color={m.color} src={m.avatar} size={30} online={isOnline(m.id)} />)}
                </div>
              </div>
            )}
          </div>

          <div data-tour="card-desc">
            <span className={lbl}>Deskripsi</span>
            <RichText key={card.id} readOnly={locked} value={card.description} onSave={(md) => void patch({ description: md })} onImage={uploadImage} placeholder="Tulis detail, acceptance criteria, catatan…" />
          </div>

          <div data-tour="card-subtasks">
            <Subtasks card={card} locked={locked} />
          </div>

          <div data-tour="card-attachments">
            <Attachments card={card} locked={locked} onChanged={refreshBoard} />
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
                    <span style={{ color: TYPE_META[k.type].color }}><Icon name={TYPE_META[k.type].icon} /></span>
                    <span className="text-xs font-medium text-slate-500">{keyOf(k)}</span>
                    <span className={`flex-1 truncate ${isDone(k) ? "text-slate-400 line-through" : ""}`}>{k.title}</span>
                    <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{data.lists.find((l) => l.id === k.list_id)?.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div data-tour="card-activity">
          <ActivityFeed activity={activity} comments={comments} user={user} doneLists={doneLists} onComment={perms.comment ? sendComment : undefined} journey={<StatusJourney card={card} lists={data.lists} activity={activity} />} />
          </div>
        </ScrollArea>

        <ScrollArea wrapperClassName="md:min-h-0" className="scroll-soft md:h-full md:overflow-y-auto md:pr-2 md:pb-2">
        <aside data-tour="card-fields" className="space-y-3.5 rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
          <Field label="Tipe">
            <Select
              disabled={locked}
              value={card.type}
              options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k as CardType, label: v.label, icon: <TypeIcon color={v.color} icon={v.icon} /> }))}
              onChange={(v) => patch({ type: v, ...(v === "epic" ? { parent_id: null, color: card.color ?? EPIC_COLORS[0] } : {}) })}
            />
          </Field>
          <div data-tour="card-status">
          <Field label="Status">
            <Select
              disabled={!editable}
              value={card.list_id}
              // only the current list and the lists its status flow allows
              options={data.lists.filter((l) => canMove(data.lists.find((x) => x.id === card.list_id), l.id)).map((l) => ({ value: l.id, label: l.name, icon: <StatusDot done={!!l.is_done} />, hint: l.is_done ? <span className="text-[11px] text-green-600">selesai</span> : undefined }))}
              onChange={(v) => patch({ list_id: v })}
            />
            <div className="mt-1.5">
              <NextStatus lists={data.lists} current={card.list_id} disabled={!editable} onMove={(id) => patch({ list_id: id })} />
            </div>
          </Field>
          </div>
          <Field label="Assignees (ditugaskan ke)" tour="card-assignees">
            <AssigneePicker value={card.assignees} disabled={locked} onChange={(ids) => patch({ assignees: ids })} />
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
                    { value: "", label: "Backlog", icon: <Icon name="list" className="h-4 w-4 text-slate-400" /> },
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
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:pointer-events-none ${on ? "shadow-sm ring-2 ring-surface ring-offset-1 ring-offset-slate-400" : "opacity-45 saturate-50 hover:opacity-90 hover:saturate-100"}`}
                    style={{ background: l.color, color: labelText(l.color) }}
                  >
                    {on && <Icon name="check" className="h-3 w-3" />}
                    {l.name}
                  </button>
                );
              })}
            </div>
          </Field>
          {!locked && <button onClick={async () => { if (await confirmDialog({ title: "Hapus kartu ini?", message: "Kartu beserta komentar dan lampirannya akan terhapus.", danger: true })) { onClose(); void mutate(() => api(`/api/cards/${card.id}`, "DELETE")); } }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-surface py-2 text-sm font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h12M8 6V4.5h4V6m-6 0 .7 10h6.6L14 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Hapus kartu
          </button>}
        </aside>
        </ScrollArea>
      </div>
      </div>
      <Tour id="card" steps={TOUR} seen={user.tours} delay={700} />
    </Modal>
  );
}

// copies the card link; shows a short confirmation
function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      void promptDialog({ title: "Salin link kartu ini", defaultValue: url, readOnly: true });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} title={url} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${copied ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-100"}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" /></svg>
      {copied ? "Link tersalin" : "Bagikan"}
    </button>
  );
}

// sidebar field: small caps label above a control
function Field({ label, children, tour }: { label: string; children: React.ReactNode; tour?: string }) {
  return (
    <div data-tour={tour}>
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
      {children}
    </div>
  );
}

// issue type badge: emoji on a tinted square
function TypeIcon({ color, icon }: { color: string; icon: IconName }) {
  return <span className="flex h-5 w-5 items-center justify-center rounded" style={{ background: `${color}22`, color }}><Icon name={icon} className="h-3.5 w-3.5" /></span>;
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
    <div className={`flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-within:border-blue-400 focus-within:ring-3 focus-within:ring-blue-100 ${disabled ? "pointer-events-none opacity-60 shadow-none" : ""}`}>
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
