"use client";
import { useEffect, useRef, useState } from "react";
import { ScrollHint } from "@/components/ui/ScrollHint";
import { MemberAvatar } from "./MemberAvatar";
import { PRIORITY_META, TYPE_META } from "@/lib/theme";
import type { Card } from "@/lib/types";
import { cardHelpers, formatDate, today, useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";

type Col = "key" | "type" | "title" | "status" | "sprint" | "priority" | "points" | "due";

const PRIORITY_RANK = { low: 0, medium: 1, high: 2, urgent: 3 };
const TYPE_RANK = { epic: 0, story: 1, task: 2, bug: 3 };

// list-only filters on top of the board-wide ones (search, type, member, sprint)
type Filters = { status: string; priority: string; label: string; due: string };
const NO_FILTERS: Filters = { status: "", priority: "", label: "", due: "" };

// yyyy-mm-dd n days from today (local time, same format as due_date)
const plusDays = (n: number) => {
  const d = new Date(today());
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// all issues in one sortable table
export function ListView({ visible }: { visible: (c: Card) => boolean }) {
  const { data, openCard } = useBoard();
  // scroll box for the scroll hint
  const scrollBox = useRef<HTMLDivElement>(null);
  const tableBox = useRef<HTMLDivElement>(null);
  const { byId, isDone, keyOf } = cardHelpers(data);
  const [sort, setSort] = useState<{ col: Col; asc: boolean }>({ col: "key", asc: true });
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const storeKey = `tb-list-filters-${data.board.id}`;

  // restore this board's list filters
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? "null");
      if (saved) setF({ ...NO_FILTERS, ...saved });
    } catch {}
  }, [storeKey]);
  const setFilter = (k: keyof Filters, v: string) => {
    const next = { ...f, [k]: v };
    setF(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {}
  };
  const resetFilters = () => {
    setF(NO_FILTERS);
    try {
      localStorage.removeItem(storeKey);
    } catch {}
  };
  const filtering = Object.values(f).some(Boolean);

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
  // card passes the list-only filters
  const now = today();
  const matches = (c: Card) => {
    if (f.status === "open" ? isDone(c) : f.status && c.list_id !== f.status) return false;
    if (f.priority && c.priority !== f.priority) return false;
    if (f.label === "none" ? c.labels.length > 0 : f.label && !c.labels.includes(f.label)) return false;
    if (f.due === "none" && c.due_date) return false;
    if (f.due === "overdue" && !(c.due_date && c.due_date < now && !isDone(c))) return false;
    if (f.due === "week" && !(c.due_date && c.due_date >= now && c.due_date <= plusDays(7))) return false;
    return true;
  };
  const base = data.cards.filter(visible);
  const rows = base.filter(matches).sort((a, b) => {
    const x = value(a, sort.col), y = value(b, sort.col);
    if (x === y) return a.number - b.number;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x < y ? -1 : 1) * (sort.asc ? 1 : -1);
  });

  // clickable column header (plain function so it is not remounted on every render)
  const th = (col: Col, label: string, className = "") => (
    <th key={col} className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${className}`}>
      <button onClick={() => setSort({ col, asc: sort.col === col ? !sort.asc : true })} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label} {sort.col === col && <Icon name={sort.asc ? "chevron-up" : "chevron-down"} className="h-3.5 w-3.5" />}
      </button>
    </th>
  );

  return (
    <div className="relative h-full">
      <div ref={scrollBox} className="scroll-thin h-full overflow-auto p-3 sm:p-4">
      <div className="overflow-hidden rounded-xl bg-surface shadow">
        {/* filter toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5 text-sm">
          <Icon name="flag" className="mx-1 h-3.5 w-3.5 text-slate-400" />
          <Select
            variant="toolbar"
            value={f.status}
            onChange={(v) => setFilter("status", v)}
            menuWidth={210}
            options={[
              { value: "", label: "Semua status" },
              { value: "open", label: "Belum selesai", icon: <span className="block h-2 w-2 rounded-full border-2 border-slate-400" /> },
              ...[...data.lists].sort((a, b) => a.position - b.position).map((l) => ({
                value: l.id,
                label: l.name,
                group: "Status",
                icon: <span className="block h-2 w-2 rounded-full" style={{ background: l.color ?? (l.is_done ? "#16a34a" : "#94a3b8") }} />,
              })),
            ]}
          />
          <Select
            variant="toolbar"
            value={f.priority}
            onChange={(v) => setFilter("priority", v)}
            menuWidth={180}
            options={[
              { value: "", label: "Semua prioritas" },
              ...(["urgent", "high", "medium", "low"] as const).map((p) => ({
                value: p,
                label: PRIORITY_META[p].label,
                icon: <span className="block h-2 w-2 rounded-full" style={{ background: PRIORITY_META[p].color }} />,
              })),
            ]}
          />
          {data.labels.length > 0 && (
            <Select
              variant="toolbar"
              value={f.label}
              onChange={(v) => setFilter("label", v)}
              searchable={data.labels.length > 6}
              menuWidth={200}
              options={[
                { value: "", label: "Semua label" },
                ...data.labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} /> })),
                { value: "none", label: "Tanpa label", icon: <Icon name="tag" className="h-3.5 w-3.5 text-slate-400" /> },
              ]}
            />
          )}
          <Select
            variant="toolbar"
            value={f.due}
            onChange={(v) => setFilter("due", v)}
            menuWidth={190}
            options={[
              { value: "", label: "Semua deadline" },
              { value: "overdue", label: "Lewat deadline", icon: <Icon name="clock" className="h-3.5 w-3.5 text-red-500" /> },
              { value: "week", label: "7 hari ke depan", icon: <Icon name="calendar" className="h-3.5 w-3.5 text-blue-500" /> },
              { value: "none", label: "Tanpa deadline", icon: <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" /> },
            ]}
          />
          {filtering && (
            <button onClick={resetFilters} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <Icon name="x" className="h-3.5 w-3.5" />Reset
            </button>
          )}
          <span className="ml-auto px-1.5 text-xs text-slate-400">
            {rows.length === base.length ? `${rows.length} issue` : `${rows.length} dari ${base.length} issue`}
          </span>
        </div>
        {/* table scrolls sideways on narrow screens */}
        <div className="relative">
        <div ref={tableBox} className="scroll-thin overflow-x-auto">
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
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                    {filtering ? <>Tidak ada issue yang cocok. <button onClick={(e) => (e.stopPropagation(), resetFilters())} className="text-blue-600 hover:underline">Reset filter</button></> : "Tidak ada issue."}
                  </td>
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
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: t.color }}><span className="inline-flex items-center gap-1.5"><Icon name={t.icon} /><span className="text-slate-600">{t.label}</span></span></td>
                    <td className="px-3 py-2">
                      <div className={done ? "text-slate-400 line-through" : "text-slate-800"}>{c.title}</div>
                      {epic && <div className="flex items-center gap-1 text-[11px]" style={{ color: epic.color ?? "#8b5cf6" }}><Icon name="epic" className="h-3 w-3" />{epic.title}</div>}
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
                        {data.members.filter((m) => c.assignees.includes(m.id)).map((m) => <MemberAvatar key={m.id} person={m} size={22} ring />)}
                      </span>
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${overdue ? "text-red-600" : "text-slate-600"}`}>{formatDate(c.due_date) || <span className="text-slate-300">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollHint box={tableBox} axis="x" />
        </div>
      </div>
      </div>
      {/* "scroll" pill while more content is below */}
      <ScrollHint box={scrollBox} />
    </div>
  );
}
