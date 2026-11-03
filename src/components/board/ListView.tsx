"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PRIORITY_META, TYPE_META } from "@/lib/theme";
import type { Card } from "@/lib/types";
import { cardHelpers, formatDate, today, useBoard } from "./context";

type Col = "key" | "type" | "title" | "status" | "sprint" | "priority" | "points" | "due";

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, urgent: 3 };
const TYPE_RANK = { epic: 0, story: 1, task: 2, bug: 3 };

// all issues in one sortable table
export function ListView({ visible }: { visible: (c: Card) => boolean }) {
  const { data, openCard } = useBoard();
  const { byId, isDone, keyOf } = cardHelpers(data);
  const [sort, setSort] = useState<{ col: Col; asc: boolean }>({ col: "key", asc: true });

  const listPos = new Map(data.lists.map((l) => [l.id, l.position]));
  const sprintName = new Map(data.sprints.map((s) => [s.id, s.name]));

  // comparable value per column; empty values always sort last
  const value = (c: Card, col: Col): string | number | null => {
    switch (col) {
      case "key": return c.number;
      case "type": return TYPE_RANK[c.type];
      case "title": return c.title.toLowerCase();
      case "status": return listPos.get(c.list_id) ?? 0;
      case "sprint": return c.sprint_id ? (sprintName.get(c.sprint_id) ?? "") : null;
      case "priority": return PRIORITY_RANK[c.priority];
      case "points": return c.points;
      case "due": return c.due_date;
    }
  };
  const rows = data.cards.filter(visible).sort((a, b) => {
    const x = value(a, sort.col), y = value(b, sort.col);
    if (x === y) return a.number - b.number;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x < y ? -1 : 1) * (sort.asc ? 1 : -1);
  });

  // clickable column header (plain function so it is not remounted on every render)
  const th = (col: Col, label: string, className = "") => (
    <th key={col} className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${className}`}>
      <button onClick={() => setSort({ col, asc: sort.col === col ? !sort.asc : true })} className="hover:text-slate-900">
        {label} {sort.col === col ? (sort.asc ? "▲" : "▼") : ""}
      </button>
    </th>
  );

  return (
    <div className="scroll-thin h-full overflow-auto p-3 sm:p-4">
      <div className="overflow-hidden rounded-xl bg-white shadow">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                {th("key", "Key")}
                {th("type", "Tipe")}
                {th("title", "Judul", "w-full")}
                {th("status", "Status")}
                {th("sprint", "Sprint")}
                {th("priority", "Prioritas")}
                {th("points", "Poin")}
                <th className="px-3 py-2 text-left font-semibold">Assignee</th>
                {th("due", "Deadline")}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">Tidak ada issue.</td>
                </tr>
              )}
              {rows.map((c) => {
                const t = TYPE_META[c.type];
                const epic = c.parent_id ? byId.get(c.parent_id) : undefined;
                const done = isDone(c);
                const overdue = c.due_date && !done && c.due_date < today();
                return (
                  <tr key={c.id} onClick={() => openCard(c.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className={`px-3 py-2 font-medium whitespace-nowrap text-slate-500 ${done ? "line-through" : ""}`}>{keyOf(c)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: t.color }}>{t.icon} <span className="text-slate-600">{t.label}</span></td>
                    <td className="px-3 py-2">
                      <div className={done ? "text-slate-400 line-through" : "text-slate-800"}>{c.title}</div>
                      {epic && <div className="text-[11px]" style={{ color: epic.color ?? "#8b5cf6" }}>⚡ {epic.title}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase ${done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {data.lists.find((l) => l.id === c.list_id)?.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{c.sprint_id ? sprintName.get(c.sprint_id) : <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[c.priority].color }} />
                        {PRIORITY_META[c.priority].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{c.points ?? <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-2">
                      <span className="flex -space-x-1.5">
                        {data.members.filter((m) => c.assignees.includes(m.id)).map((m) => <Avatar key={m.id} name={m.name} color={m.color} size={22} ring />)}
                      </span>
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${overdue ? "text-red-600" : "text-slate-600"}`}>{formatDate(c.due_date) || <span className="text-slate-300">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
