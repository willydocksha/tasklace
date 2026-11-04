"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "@/components/Avatar";
import { PRIORITY_META, TYPE_META, labelText } from "@/lib/theme";
import type { Card } from "@/lib/types";
import { cardHelpers, formatDate, subtaskProgress, today, useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";

export function CardView({ card, overlay }: { card: Card; overlay?: boolean }) {
  const { data, openCard } = useBoard();
  const { byId, isDone, progress, keyOf } = cardHelpers(data);
  const t = TYPE_META[card.type];
  const epic = card.parent_id ? byId.get(card.parent_id) : undefined;
  const labels = data.labels.filter((l) => card.labels.includes(l.id));
  const people = data.members.filter((m) => card.assignees.includes(m.id));
  const done = isDone(card);
  const overdue = card.due_date && !done && card.due_date < today();
  const prog = card.type === "epic" ? progress(card.id) : null;
  const subs = subtaskProgress(data, card);

  return (
    <div
      onClick={() => openCard(card.id)}
      className={`group cursor-pointer rounded-lg bg-surface select-none p-2.5 text-sm shadow-[0_1px_1px_rgba(9,30,66,.25)] hover:ring-2 hover:ring-blue-400 ${overlay ? "rotate-2 shadow-xl ring-2 ring-blue-400" : ""}`}
      style={card.type === "epic" && card.color ? { borderLeft: `4px solid ${card.color}` } : undefined}
    >
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => (
            <span key={l.id} className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: l.color, color: labelText(l.color) }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className={`flex gap-1.5 ${done ? "text-slate-500 line-through" : ""}`}>
        <span title={t.label} className="mt-0.5" style={{ color: t.color }}>
          <Icon name={t.icon} className="h-3.5 w-3.5" />
        </span>
        <span className="break-words">{card.title}</span>
      </div>
      {epic && (
        <div className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: (epic.color ?? "#8b5cf6") + "22", color: epic.color ?? "#8b5cf6" }}>
          <Icon name="epic" className="h-3 w-3" />
          <span className="truncate">{epic.title}</span>
        </div>
      )}
      {prog && prog.total > 0 && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded bg-slate-200">
            <div className="h-full rounded" style={{ width: `${prog.pct}%`, background: card.color ?? "#8b5cf6" }} />
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {prog.done}/{prog.total} selesai
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className={`font-medium ${done ? "line-through" : ""}`}>{keyOf(card)}</span>
        {card.priority !== "medium" && (
          <span className="rounded px-1 font-medium text-white" style={{ background: PRIORITY_META[card.priority].color }}>
            {PRIORITY_META[card.priority].label}
          </span>
        )}
        {card.due_date && (
          <span className={`inline-flex items-center gap-1 rounded px-1 ${done ? "bg-green-100 text-green-700" : overdue ? "bg-red-100 text-red-700" : ""}`}><Icon name="clock" className="h-3 w-3" />{formatDate(card.due_date)}</span>
        )}
        {card.description && <span title="Ada deskripsi" className="inline-flex"><Icon name="text" className="h-3 w-3" /></span>}
        {card.comment_count > 0 && <span className="inline-flex items-center gap-1"><Icon name="comment" className="h-3 w-3" />{card.comment_count}</span>}
        {card.attachment_count > 0 && <span title="Lampiran" className="inline-flex items-center gap-1"><Icon name="paperclip" className="h-3 w-3" />{card.attachment_count}</span>}
        {subs.total > 0 && (
          <span title="Subtask selesai" className={`inline-flex items-center gap-1 rounded px-1 ${subs.done === subs.total ? "bg-green-100 text-green-700" : ""}`}><Icon name="checklist" className="h-3 w-3" />{subs.done}/{subs.total}</span>
        )}
        {card.points != null && (
          <span title="Story points" className="rounded-full bg-slate-200 px-1.5 font-semibold text-slate-700">
            {card.points}
          </span>
        )}
        <span className="ml-auto flex -space-x-1.5">
          {people.map((p) => (
            <Avatar key={p.id} name={p.name} color={p.color} src={p.avatar} size={22} ring />
          ))}
        </span>
      </div>
    </div>
  );
}

// tour marks the card the board tour points at
export function SortableCard({ card, disabled, tour }: { card: Card; disabled?: boolean; tour?: boolean }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: "c:" + card.id, data: { type: "card" }, disabled });
  return (
    <div ref={setNodeRef} data-tour={tour ? "card" : undefined} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} {...attributes} {...listeners}>
      <CardView card={card} />
    </div>
  );
}
