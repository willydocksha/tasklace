"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { confirmDialog } from "@/components/ui/Dialog";
import { api } from "@/lib/client";
import { TYPE_META } from "@/lib/theme";
import type { Card, Sprint } from "@/lib/types";
import { cardHelpers, daysLeft, formatDate, today, useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";

type Visible = (c: Card) => boolean;

export function Backlog({ visible }: { visible: Visible }) {
  const { data, mutate, perms } = useBoard();
  const [editing, setEditing] = useState<{ sprint: Sprint; start: boolean } | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [history, setHistory] = useState(false);

  // epics are tracked in storyline, not in sprints
  const issues = data.cards.filter((c) => c.type !== "epic" && visible(c));
  const open = data.sprints.filter((s) => s.status !== "completed").sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
  const done = data.sprints.filter((s) => s.status === "completed");
  const hasActive = open.some((s) => s.status === "active");

  return (
    <div className="scroll-thin h-full overflow-y-auto p-3 sm:p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white drop-shadow">Backlog &amp; Sprint</h2>
          {perms.structure && (
            <button onClick={() => mutate(() => api(`/api/boards/${data.board.id}/sprints`, "POST", {}))} className="ml-auto rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-slate-800 shadow hover:bg-slate-100">
              + Buat sprint
            </button>
          )}
        </div>

        {open.map((s) => (
          <Section
            key={s.id}
            sprint={s}
            cards={issues.filter((c) => c.sprint_id === s.id)}
            canStart={!hasActive}
            onEdit={() => setEditing({ sprint: s, start: false })}
            onStart={() => setEditing({ sprint: s, start: true })}
            onComplete={() => setCompleting(s)}
          />
        ))}

        <Section cards={issues.filter((c) => !c.sprint_id)} />

        {done.length > 0 && (
          <div className="rounded-xl bg-surface/95 shadow">
            <button onClick={() => setHistory(!history)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700">
              <Icon name={history ? "chevron-down" : "chevron-right"} className="h-3.5 w-3.5" /> Riwayat sprint ({done.length})
            </button>
            {history && <History sprints={done} />}
          </div>
        )}
      </div>

      {editing && <SprintForm sprint={editing.sprint} start={editing.start} onClose={() => setEditing(null)} />}
      {completing && <CompleteSprint sprint={completing} onClose={() => setCompleting(null)} />}
    </div>
  );
}

// one sprint (or the backlog when no sprint is given) with its issues
function Section({
  sprint,
  cards,
  canStart,
  onEdit,
  onStart,
  onComplete,
}: {
  sprint?: Sprint;
  cards: Card[];
  canStart?: boolean;
  onEdit?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
}) {
  const { data, mutate, perms } = useBoard();
  const { points, isDone } = cardHelpers(data);
  const pts = points(cards);
  const left = sprint?.status === "active" ? daysLeft(sprint.end_date) : null;
  const doneCount = cards.filter(isDone).length;

  return (
    <div className={`rounded-xl bg-surface shadow ${sprint?.status === "active" ? "ring-2 ring-blue-500" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{sprint ? sprint.name : "Backlog"}</span>
            {sprint?.status === "active" && <span className="rounded bg-blue-100 px-1.5 text-xs font-medium text-blue-700">aktif</span>}
            <span className="text-xs text-slate-500">
              {cards.length} issue{pts.total > 0 && ` · ${pts.done}/${pts.total} poin`}
              {sprint && cards.length > 0 && ` · ${doneCount} selesai`}
            </span>
          </div>
          {sprint && (sprint.start_date || sprint.goal) && (
            <div className="truncate text-xs text-slate-500">
              {sprint.start_date && `${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}`}
              {left !== null && <span className={left < 0 ? "text-red-600" : ""}> · {left < 0 ? `lewat ${-left} hari` : `${left} hari lagi`}</span>}
              {sprint.goal && <> · <Icon name="target" className="h-3 w-3" /> {sprint.goal}</>}
            </div>
          )}
        </div>
        {sprint && perms.structure && (
          <div className="ml-auto flex items-center gap-1.5 text-sm">
            {sprint.status === "planned" && (
              <button
                onClick={onStart}
                disabled={!canStart}
                title={canStart ? "" : "Selesaikan sprint aktif dulu"}
                className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white disabled:opacity-40"
              >
                Mulai sprint
              </button>
            )}
            {sprint.status === "active" && (
              <button onClick={onComplete} className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white">
                Selesaikan sprint
              </button>
            )}
            <button onClick={onEdit} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
              Edit
            </button>
            {sprint.status === "planned" && (
              <button
                onClick={async () => (await confirmDialog({ title: `Hapus ${sprint.name}?`, message: "Issue di dalamnya kembali ke backlog.", danger: true })) && mutate(() => api(`/api/sprints/${sprint.id}`, "DELETE"))}
                className="rounded-md px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Icon name="x" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="divide-y">
        {cards.length === 0 && (
          <div className="px-4 py-3 text-sm text-slate-400">{sprint ? "Belum ada issue. Pindahkan dari backlog, atau buat di bawah." : "Backlog kosong."}</div>
        )}
        {cards.map((c) => (
          <Row key={c.id} card={c} />
        ))}
      </div>
      <AddIssue sprintId={sprint?.id ?? null} />
    </div>
  );
}

// a compact issue row with a quick "move to sprint" picker
function Row({ card }: { card: Card }) {
  const { data, mutate, openCard, canEdit, isOnline } = useBoard();
  const { byId, isDone, keyOf } = cardHelpers(data);
  const t = TYPE_META[card.type];
  const epic = card.parent_id ? byId.get(card.parent_id) : undefined;
  const list = data.lists.find((l) => l.id === card.list_id);
  const people = data.members.filter((m) => card.assignees.includes(m.id));
  const done = isDone(card);
  const overdue = card.due_date && !done && card.due_date < today();

  return (
    <div onClick={() => openCard(card.id)} className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
      <span style={{ color: t.color }} title={t.label}>
        <Icon name={t.icon} />
      </span>
      <span className={`shrink-0 text-xs font-medium text-slate-500 ${done ? "line-through" : ""}`}>{keyOf(card)}</span>
      <span className={`min-w-0 flex-1 truncate ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{card.title}</span>
      {epic && (
        <span className="hidden max-w-40 truncate rounded px-1.5 text-[11px] font-medium sm:inline" style={{ background: (epic.color ?? "#8b5cf6") + "22", color: epic.color ?? "#8b5cf6" }}>
          {epic.title}
        </span>
      )}
      {card.due_date && <span className={`hidden text-xs sm:inline ${overdue ? "text-red-600" : "text-slate-500"}`}>{formatDate(card.due_date)}</span>}
      <span className={`hidden rounded px-1.5 text-[11px] font-medium uppercase sm:inline ${done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{list?.name}</span>
      <span className="w-7 text-center">
        {card.points != null && <span className="rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-700">{card.points}</span>}
      </span>
      <span className="hidden w-12 justify-end -space-x-1.5 sm:flex">
        {people.slice(0, 3).map((p) => (
          <Avatar key={p.id} name={p.name} color={p.color} src={p.avatar} size={22} ring online={isOnline(p.id)} />
        ))}
      </span>
      {/* quick sprint move; wrapper keeps clicks and drags from reaching the row */}
      <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} className="shrink-0">
        <Select
          value={card.sprint_id ?? ""}
          // done cards are locked; so are cards the user may not edit
          disabled={done || !canEdit(card)}
          onChange={(v) => mutate(() => api(`/api/cards/${card.id}`, "PATCH", { sprint_id: v || null }))}
          variant="toolbar"
          placement="bottom-end"
          className="!h-6 w-24 border border-slate-200 bg-surface text-xs"
          title={done ? "Kartu selesai dikunci" : "Pindahkan ke sprint"}
          options={[{ value: "", label: "Backlog" }, ...data.sprints.filter((s) => s.status !== "completed").map((s) => ({ value: s.id, label: s.name }))]}
        />
      </span>
    </div>
  );
}

// quick-create an issue straight into a sprint or the backlog
function AddIssue({ sprintId }: { sprintId: string | null }) {
  const { data, mutate, perms } = useBoard();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("story");
  if (!perms.createCard) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void mutate(() => api(`/api/boards/${data.board.id}/cards`, "POST", { title, type, sprintId })).then(() => setTitle(""));
      }}
      className="flex items-center gap-2 border-t px-4 py-2"
    >
      {/* issue type with its icon */}
      <Select
        value={type}
        onChange={setType}
        className="!h-8 !w-28 shrink-0"
        options={(["story", "task", "bug"] as const).map((k) => ({ value: k, label: TYPE_META[k].label, icon: <span style={{ color: TYPE_META[k].color }}><Icon name={TYPE_META[k].icon} /></span> }))}
      />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="+ Buat issue" className="min-w-0 flex-1 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
      {title && <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Tambah</button>}
    </form>
  );
}

// completed sprints with their delivered points
function History({ sprints }: { sprints: Sprint[] }) {
  const { data } = useBoard();
  const { points } = cardHelpers(data);
  return (
    <div className="divide-y border-t">
      {sprints.map((s) => {
        const cards = data.cards.filter((c) => c.sprint_id === s.id);
        const p = points(cards);
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2 text-sm">
            <span className="font-medium text-slate-700">{s.name}</span>
            <span className="text-xs text-slate-500">
              {formatDate(s.start_date)} – {formatDate(s.end_date)}
            </span>
            <span className="ml-auto text-xs text-slate-600">
              {cards.length} issue selesai · {p.done} poin
            </span>
          </div>
        );
      })}
    </div>
  );
}

// edit a sprint, or confirm its dates before starting it
function SprintForm({ sprint, start, onClose }: { sprint: Sprint; start: boolean; onClose: () => void }) {
  const { mutate } = useBoard();
  const begin = sprint.start_date ?? today();
  const [f, setF] = useState({
    name: sprint.name,
    goal: sprint.goal,
    start_date: begin,
    end_date: sprint.end_date ?? new Date(Date.parse(begin + "T00:00:00Z") + 14 * 86400_000).toISOString().slice(0, 10),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const inp = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

  return (
    <Modal onClose={onClose} width={440}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          void mutate(() => api(`/api/sprints/${sprint.id}`, "PATCH", { ...f, ...(start ? { action: "start" } : {}) }));
        }}
        className="space-y-3 p-5"
      >
        <h3 className="text-lg font-bold">{start ? `Mulai ${sprint.name}` : "Edit sprint"}</h3>
        <label className="block text-sm">
          Nama
          <input className={inp} value={f.name} onChange={set("name")} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            Mulai
            <input type="date" className={inp} value={f.start_date} onChange={set("start_date")} />
          </label>
          <label className="block text-sm">
            Selesai
            <input type="date" className={inp} value={f.end_date} onChange={set("end_date")} />
          </label>
        </div>
        <label className="block text-sm">
          Sprint goal
          <textarea rows={2} className={inp} value={f.goal} onChange={set("goal")} placeholder="Apa yang mau dicapai di sprint ini?" />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-slate-100">
            Batal
          </button>
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">{start ? "Mulai" : "Simpan"}</button>
        </div>
      </form>
    </Modal>
  );
}

// close the active sprint and decide where unfinished issues go
function CompleteSprint({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const { data, mutate } = useBoard();
  const { isDone, points } = cardHelpers(data);
  const cards = data.cards.filter((c) => c.sprint_id === sprint.id);
  const finished = cards.filter(isDone);
  const planned = data.sprints.filter((s) => s.status === "planned");
  const [moveTo, setMoveTo] = useState("");

  return (
    <Modal onClose={onClose} width={440}>
      <div className="space-y-3 p-5">
        <h3 className="text-lg font-bold">Selesaikan {sprint.name}</h3>
        <p className="text-sm text-slate-600">
          <b>{finished.length}</b> issue selesai ({points(finished).done} poin), <b>{cards.length - finished.length}</b> belum selesai.
        </p>
        {cards.length > finished.length && (
          <label className="block text-sm">
            Pindahkan issue yang belum selesai ke
            {/* where unfinished issues go */}
            <Select value={moveTo} onChange={setMoveTo} className="mt-1" options={[{ value: "", label: "Backlog" }, ...planned.map((s) => ({ value: s.id, label: s.name }))]} />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm hover:bg-slate-100">
            Batal
          </button>
          <button
            onClick={() => {
              onClose();
              void mutate(() => api(`/api/sprints/${sprint.id}`, "PATCH", { action: "complete", moveTo: moveTo || null }));
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Selesaikan sprint
          </button>
        </div>
      </div>
    </Modal>
  );
}
