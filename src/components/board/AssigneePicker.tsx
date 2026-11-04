"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { useBoard } from "./context";
import { Icon } from "@/components/ui/Icon";

// pick one or more assignees from the board members
export function AssigneePicker({ value, onChange, disabled = false, variant = "field" }: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  variant?: "field" | "compact";
}) {
  const { data, user } = useBoard();
  const pop = usePopover({ placement: variant === "field" ? "bottom-start" : "bottom-end", matchWidth: variant === "field" });
  const [q, setQ] = useState("");
  // local copy so checks flip instantly while the save runs
  const [sel, setSel] = useState(value);
  useEffect(() => setSel(value), [value]);
  useEffect(() => {
    if (pop.open) setQ("");
  }, [pop.open]);

  const people = data.members.filter((m) => sel.includes(m.id));
  // current user first, then everyone else matching the search
  const shown = [...data.members]
    .sort((a, b) => Number(b.id === user.id) - Number(a.id === user.id))
    .filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q.trim().toLowerCase()));

  function toggle(id: string) {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next);
    onChange(next);
  }

  return (
    <>
      {variant === "field" ? (
        <button
          ref={pop.refs.setReference}
          disabled={disabled}
          onClick={() => pop.setOpen(!pop.open)}
          data-open={pop.open}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-surface px-2 py-1 text-left text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 disabled:pointer-events-none disabled:opacity-60 data-[open=true]:border-blue-400 data-[open=true]:ring-3 data-[open=true]:ring-blue-100"
        >
          {people.length ? (
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {people.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-2 pl-0.5 text-xs font-medium">
                  <Avatar name={m.name} color={m.color} src={m.avatar} size={18} />
                  <span className="max-w-24 truncate">{m.id === user.id ? "Saya" : m.name}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="flex-1 text-slate-400">Belum ada assignee</span>
          )}
          <span className="text-slate-400">+</span>
        </button>
      ) : (
        <button
          ref={pop.refs.setReference}
          disabled={disabled}
          onClick={() => pop.setOpen(!pop.open)}
          title={people.length ? `Assignees: ${people.map((m) => m.name).join(", ")}` : "Tambah assignee"}
          className="flex shrink-0 items-center rounded-full disabled:pointer-events-none"
        >
          {people.length ? (
            <span className="flex -space-x-1.5">
              {people.slice(0, 3).map((m) => <Avatar key={m.id} name={m.name} color={m.color} src={m.avatar} size={22} ring />)}
              {people.length > 3 && <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold ring-2 ring-surface">+{people.length - 3}</span>}
            </span>
          ) : (
            !disabled && (
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="7" r="3" /><path d="M4.5 17a5.5 5.5 0 0 1 11 0" /></svg>
              </span>
            )
          )}
        </button>
      )}
      <PopoverPanel pop={pop} className="w-64" onKeyDown={(e) => {
        // escape closes only the menu, not a surrounding modal
        if (e.key !== "Escape") return;
        e.stopPropagation();
        pop.setOpen(false);
      }}>
        <div className="border-b border-slate-100 p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari member…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
        </div>
        <div className="scroll-thin overflow-y-auto p-1">
          {shown.map((m) => {
            const on = sel.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${on ? "bg-blue-50/70" : "hover:bg-slate-50"}`}>
                <Avatar name={m.name} color={m.color} src={m.avatar} size={22} />
                <span className="min-w-0 flex-1 truncate">{m.name}{m.id === user.id && <span className="text-slate-400"> (saya)</span>}</span>
                <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{on && <Icon name="check" className="h-3 w-3" />}</span>
              </button>
            );
          })}
          {!shown.length && <div className="p-3 text-center text-sm text-slate-400">Member tidak ditemukan</div>}
        </div>
      </PopoverPanel>
    </>
  );
}
