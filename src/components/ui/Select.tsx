"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PopoverPanel, usePopover } from "./Popover";

export type Option<V extends string> = {
  value: V;
  label: string;
  icon?: React.ReactNode;
  // right-aligned extra (shortcut chip, count, badge)
  hint?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  // custom row content (e.g. a heading preview); label is still used for search
  render?: React.ReactNode;
  // optional section title shown above the first option of a group
  group?: string;
};

type Variant = "field" | "dark" | "toolbar";

// trigger looks per placement
const TRIGGER: Record<Variant, string> = {
  field:
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50/60 data-[open=true]:border-blue-400 data-[open=true]:ring-3 data-[open=true]:ring-blue-100",
  dark: "h-8 rounded-lg bg-white/15 px-2.5 text-sm text-white ring-1 ring-white/15 hover:bg-white/25 data-[open=true]:bg-white/30",
  toolbar: "h-7 rounded-md px-1.5 text-sm text-slate-600 hover:bg-slate-100 data-[open=true]:bg-blue-50 data-[open=true]:text-blue-700",
};

// custom dropdown: icons, hints, keyboard nav and optional search
export function Select<V extends string>({
  value,
  options,
  onChange,
  placeholder = "Pilih…",
  variant = "field",
  searchable = false,
  renderValue,
  menuWidth,
  placement,
  title,
  className = "",
}: {
  value: V;
  options: Option<V>[];
  onChange: (v: V) => void;
  placeholder?: string;
  variant?: Variant;
  searchable?: boolean;
  // custom trigger content
  renderValue?: (o: Option<V> | undefined) => React.ReactNode;
  menuWidth?: number;
  placement?: "bottom-start" | "bottom-end";
  title?: string;
  className?: string;
}) {
  const pop = usePopover({ placement, matchWidth: variant === "field" });
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const current = options.find((o) => o.value === value);

  // search filters by label and description
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.description?.toLowerCase().includes(s)) : options;
  }, [options, q]);

  // on open: reset search, highlight the current value, focus the menu
  useEffect(() => {
    if (!pop.open) return;
    setQ("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    requestAnimationFrame(() => (searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true }));
  }, [pop.open]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the highlighted row visible
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, pop.open]);

  function close(refocus = true) {
    pop.setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }
  function pick(o: Option<V>) {
    if (o.disabled) return;
    onChange(o.value);
    close();
  }
  // move highlight, skipping disabled rows
  function step(dir: 1 | -1) {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + dir + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Tab") return close(false);
    if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "ArrowDown") step(1);
    else if (e.key === "ArrowUp") step(-1);
    else if (e.key === "Enter") {
      if (shown[active]) pick(shown[active]);
    } else {
      // escape closes only the menu, not a surrounding modal
      e.stopPropagation();
      close();
    }
  }

  return (
    <>
      <button
        type="button"
        ref={(el) => {
          triggerRef.current = el;
          pop.refs.setReference(el);
        }}
        title={title}
        data-open={pop.open}
        onMouseDown={(e) => variant === "toolbar" && e.preventDefault()}
        onClick={() => pop.setOpen(!pop.open)}
        onKeyDown={(e) => {
          if (!pop.open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            pop.setOpen(true);
          }
        }}
        className={`group inline-flex min-w-0 items-center gap-1.5 text-left transition outline-none focus-visible:ring-3 focus-visible:ring-blue-200 ${TRIGGER[variant]} ${className}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {renderValue ? renderValue(current) : current ? (
            <>
              {current.icon && <span className="shrink-0">{current.icon}</span>}
              <span className="truncate">{current.label}</span>
            </>
          ) : (
            <span className={variant === "dark" ? "text-white/70" : "text-slate-400"}>{placeholder}</span>
          )}
        </span>
        <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 opacity-60 transition group-data-[open=true]:rotate-180`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <PopoverPanel pop={pop} onKeyDown={onKey} className="min-w-44">
        <div style={menuWidth ? { width: menuWidth } : undefined} className="flex min-h-0 flex-col">
          {searchable && (
            <div className="border-b border-slate-100 p-2">
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => (setQ(e.target.value), setActive(0))}
                placeholder="Cari…"
                className="h-8 w-full rounded-md bg-slate-100 px-2.5 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-200"
              />
            </div>
          )}
          <div ref={listRef} tabIndex={-1} role="listbox" className="min-h-0 overflow-y-auto p-1 outline-none">
            {shown.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-400">Tidak ada hasil</div>}
            {shown.map((o, i) => {
              const selected = o.value === value;
              const showGroup = o.group && o.group !== shown[i - 1]?.group;
              return (
                <div key={o.value || "__empty"}>
                  {showGroup && <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{o.group}</div>}
                  <div
                    role="option"
                    aria-selected={selected}
                    aria-disabled={o.disabled}
                    data-idx={i}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => pick(o)}
                    className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm select-none ${o.disabled ? "cursor-not-allowed opacity-40" : ""} ${i === active && !o.disabled ? "bg-slate-100" : ""} ${selected ? "font-medium text-blue-700" : ""}`}
                  >
                    {selected && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-blue-600" />}
                    {o.icon && <span className="flex w-5 shrink-0 justify-center">{o.icon}</span>}
                    <span className="min-w-0 flex-1">
                      {o.render ?? <span className="block truncate">{o.label}</span>}
                      {o.description && <span className="block truncate text-xs font-normal text-slate-400">{o.description}</span>}
                    </span>
                    {o.hint && <span className="shrink-0 text-xs text-slate-400">{o.hint}</span>}
                    {selected && !o.hint && (
                      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}

// small keyboard-shortcut chip for option hints
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500">{children}</kbd>;
}
