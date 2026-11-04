"use client";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { nextOptions } from "@/lib/flow";
import type { List } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

// one click moves to the only allowed next status; several choices open a small menu
export function NextStatus({ lists, current, onMove, variant = "button", disabled = false }: {
  lists: List[];
  current: string | null;
  onMove: (listId: string) => void;
  variant?: "button" | "pill";
  disabled?: boolean;
}) {
  const pop = usePopover({ placement: "bottom-end" });
  const options = nextOptions(lists, current);
  const cur = lists.find((l) => l.id === current);
  const single = options.length === 1 ? options[0] : null;

  // move now, or open the menu when there is a choice
  function click() {
    if (single) onMove(single.id);
    else pop.setOpen(!pop.open);
  }

  const none = !options.length || disabled;
  const hint = !options.length ? "Tidak ada status berikutnya" : single ? `Pindah ke ${single.name}` : "Pilih status berikutnya";

  return (
    <>
      {variant === "button" ? (
        <button
          ref={pop.refs.setReference}
          disabled={none}
          onClick={click}
          title={hint}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:hover:bg-blue-500"
        >
          {!options.length ? "Tidak ada status berikutnya" : single ? <>Lanjut ke <b className="truncate">{single.name}</b> <Icon name="arrow-right" /></> : <>Status berikutnya <Icon name="chevron-down" /></>}
        </button>
      ) : (
        <button
          ref={pop.refs.setReference}
          disabled={none}
          onClick={click}
          title={hint}
          className={`group flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 transition disabled:cursor-default ${cur?.is_done ? "bg-green-50 text-green-700 ring-green-200" : "bg-slate-50 text-slate-600 ring-slate-200"} enabled:hover:bg-blue-50 enabled:hover:text-blue-700 enabled:hover:ring-blue-300`}
        >
          {cur?.is_done && <Icon name="check" className="h-3.5 w-3.5" />}{cur?.name ?? "?"}
          {options.length > 0 && !disabled && <span className="text-slate-400 group-hover:text-blue-600"><Icon name={single ? "arrow-right" : "chevron-down"} /></span>}
        </button>
      )}
      <PopoverPanel pop={pop} className="w-52 py-1 text-sm" onKeyDown={(e) => {
        // escape closes only the menu, not a surrounding modal
        if (e.key !== "Escape") return;
        e.stopPropagation();
        pop.setOpen(false);
      }}>
        <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Pindah ke</div>
        {options.map((l) => (
          <button key={l.id} onClick={() => (pop.setOpen(false), onMove(l.id))} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100">
            <span className={`h-2.5 w-2.5 rounded-full ${l.is_done ? "bg-green-500" : ""}`} style={l.is_done ? undefined : { background: l.color ?? "#94a3b8" }} />
            <span className="flex-1 truncate">{l.name}</span>
            {l.is_done ? <span className="text-[11px] text-green-600">selesai</span> : null}
          </button>
        ))}
      </PopoverPanel>
    </>
  );
}
