"use client";
import { useEffect, useRef, useState } from "react";
import { PopoverPanel, usePopover } from "./Popover";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// yyyy-mm-dd <-> local date (no timezone shifts)
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const todayDate = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

// short relative label for the trigger chip
function relative(iso: string, deadline: boolean) {
  const diff = dayDiff(fromISO(iso), todayDate());
  if (diff === 0) return { text: "Hari ini", cls: deadline ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700" };
  if (diff === 1) return { text: "Besok", cls: deadline ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600" };
  if (diff < 0 && deadline) return { text: `Lewat ${-diff} hari`, cls: "bg-red-100 text-red-700" };
  if (diff > 1 && diff <= 7) return { text: `${diff} hari lagi`, cls: "bg-slate-100 text-slate-600" };
  return null;
}

// date field with a calendar popover and quick picks
export function DatePicker({ value, onChange, placeholder = "Pilih tanggal", deadline = false, min }: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  // deadline styling: overdue turns red
  deadline?: boolean;
  // earliest selectable date (yyyy-mm-dd)
  min?: string | null;
}) {
  const pop = usePopover({ placement: "bottom-start" });
  const [view, setView] = useState(() => (value ? fromISO(value) : todayDate()));
  const [focus, setFocus] = useState<Date>(() => (value ? fromISO(value) : todayDate()));
  const gridRef = useRef<HTMLDivElement>(null);

  // reopen on the selected month
  useEffect(() => {
    if (!pop.open) return;
    const d = value ? fromISO(value) : todayDate();
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
    setFocus(d);
    // focus the calendar so arrow keys work right away
    requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
  }, [pop.open]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(d: Date | null) {
    onChange(d ? toISO(d) : null);
    pop.setOpen(false);
  }

  // 6-week grid starting on monday
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = todayDate();
  const minD = min ? fromISO(min) : null;
  const month = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  // arrow keys move the focused day, enter picks it
  function onKey(e: React.KeyboardEvent) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      const next = addDays(focus, moves[e.key]);
      setFocus(next);
      if (next.getMonth() !== view.getMonth()) setView(new Date(next.getFullYear(), next.getMonth(), 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!(minD && focus < minD)) pick(focus);
    } else if (e.key === "Escape") {
      // escape closes only the calendar, not a surrounding modal
      e.preventDefault();
      e.stopPropagation();
      pop.setOpen(false);
    }
  }

  const rel = value ? relative(value, deadline) : null;
  const overdue = deadline && value && dayDiff(fromISO(value), today) < 0;

  return (
    <>
      <button
        type="button"
        ref={pop.refs.setReference}
        data-open={pop.open}
        onClick={() => pop.setOpen(!pop.open)}
        className={`group flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border bg-white px-2.5 text-left text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition outline-none hover:border-slate-300 focus-visible:ring-3 focus-visible:ring-blue-200 data-[open=true]:border-blue-400 data-[open=true]:ring-3 data-[open=true]:ring-blue-100 ${overdue ? "border-red-200" : "border-slate-200"}`}
      >
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${overdue ? "text-red-500" : "text-slate-400"}`} fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
          <path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" strokeLinecap="round" />
        </svg>
        {value ? (
          <span className="truncate">{fromISO(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
        ) : (
          <span className="truncate text-slate-400">{placeholder}</span>
        )}
        {rel && <span className={`ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${rel.cls}`}>{rel.text}</span>}
      </button>

      <PopoverPanel pop={pop} className="w-[284px]">
        <div tabIndex={-1} ref={gridRef} onKeyDown={onKey} className="p-3 outline-none">
          {/* month header */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => month(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Bulan sebelumnya">‹</button>
            <div className="text-sm font-semibold">{MONTHS[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" onClick={() => month(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Bulan berikutnya">›</button>
          </div>

          {/* weekday labels + day grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DAYS.map((d) => <div key={d} className="pb-1 text-[11px] font-medium text-slate-400">{d}</div>)}
            {cells.map((d) => {
              const iso = toISO(d);
              const out = d.getMonth() !== view.getMonth();
              const sel = iso === value;
              const isToday = iso === toISO(today);
              const isFocus = iso === toISO(focus);
              const disabled = !!minD && d < minD;
              return (
                <button
                  type="button"
                  key={iso}
                  disabled={disabled}
                  onClick={() => pick(d)}
                  onMouseEnter={() => setFocus(d)}
                  className={`relative h-9 rounded-lg text-sm transition ${sel ? "bg-blue-600 font-semibold text-white shadow-sm" : isFocus ? "bg-slate-100" : ""} ${out && !sel ? "text-slate-300" : ""} ${disabled ? "cursor-not-allowed opacity-30" : ""} ${isToday && !sel ? "font-semibold text-blue-600" : ""}`}
                >
                  {d.getDate()}
                  {isToday && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${sel ? "bg-white" : "bg-blue-600"}`} />}
                </button>
              );
            })}
          </div>

          {/* quick picks */}
          <div className="mt-3 grid grid-cols-4 gap-1 border-t border-slate-100 pt-3">
            {[
              ["Hari ini", today],
              ["Besok", addDays(today, 1)],
              ["+7 hari", addDays(today, 7)],
              ["+14 hari", addDays(today, 14)],
            ].map(([l, d]) => (
              <button type="button" key={l as string} onClick={() => pick(d as Date)} disabled={!!minD && (d as Date) < minD} className="rounded-md bg-slate-100 px-1 py-1.5 text-xs font-medium whitespace-nowrap text-slate-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40">
                {l as string}
              </button>
            ))}
            {value && (
              <button type="button" onClick={() => pick(null)} className="col-span-4 mt-0.5 rounded-md py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                Hapus tanggal
              </button>
            )}
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}
