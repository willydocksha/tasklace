"use client";
import { confirmDialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

type Item = { id: string; name: string; color: string | null };
export type FlowMap = Record<string, string[] | null>;

// per-status "may move to" chips, shared by the board flow and team workflow editors.
// next[id] null = free (any status); onChange gets only the statuses that changed
export function FlowEditor({ items, next, onChange, readOnly = false, noun = "Kartu" }: {
  items: Item[];
  next: FlowMap;
  onChange: (changes: FlowMap) => void;
  readOnly?: boolean;
  noun?: string;
}) {
  // toggle one target; the first pick turns a free status into a restricted one
  function toggle(id: string, target: string) {
    const base = next[id] ?? [];
    onChange({ [id]: base.includes(target) ? base.filter((x) => x !== target) : [...base, target] });
  }

  // preset: each status only goes to the next one; the last stays free
  async function sequential() {
    if (!(await confirmDialog({ title: "Atur alur berurutan?", message: "Alur mengikuti urutan status. Aturan yang ada akan diganti.", confirmLabel: "Terapkan" }))) return;
    onChange(Object.fromEntries(items.map((l, i) => [l.id, i < items.length - 1 ? [items[i + 1].id] : null])));
  }

  // preset: remove every rule
  async function reset() {
    if (!(await confirmDialog({ title: "Hapus semua aturan alur?", message: `${noun} bisa dipindah bebas lagi.`, danger: true }))) return;
    onChange(Object.fromEntries(items.filter((l) => next[l.id]).map((l) => [l.id, null])));
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button onClick={sequential} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"><Icon name="arrow-right" />Isi alur berurutan</button>
          <button onClick={reset} className="rounded-md border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Bebaskan semua</button>
        </div>
      )}
      <div className="space-y-2">
        {items.map((l) => {
          const cur = next[l.id] ?? null;
          return (
            <div key={l.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color ?? "#94a3b8" }} />
                <b className="text-sm">{l.name}</b>
                <span className="text-xs text-slate-400">boleh ke</span>
                {readOnly ? (
                  !cur && <span className="ml-auto text-xs text-slate-500">Bebas</span>
                ) : (
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                    <input type="checkbox" checked={!cur} onChange={(e) => onChange({ [l.id]: e.target.checked ? null : [] })} />
                    Bebas
                  </label>
                )}
              </div>
              {cur && (
                <div className="flex flex-wrap gap-1.5">
                  {items.filter((t) => t.id !== l.id).map((t) => {
                    const on = cur.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        disabled={readOnly}
                        onClick={() => toggle(l.id, t.id)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-blue-600 bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"} disabled:cursor-default`}
                      >
                        {on && <Icon name="check" className="h-3 w-3" />}{t.name}
                      </button>
                    );
                  })}
                  {!cur.some((x) => items.some((t) => t.id === x)) && <span className="text-xs text-amber-600">{noun} di status ini tidak bisa dipindah.</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// chips to choose which statuses subtasks may use (at least one stays on)
export function SubtaskStatusPicker({ items, used, onToggle, readOnly = false }: {
  items: Item[];
  used: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((l) => {
        const on = used.has(l.id);
        const last = on && used.size === 1;
        return (
          <button
            key={l.id}
            disabled={readOnly || last}
            title={last ? "Minimal satu status dipakai subtask" : undefined}
            onClick={() => onToggle(l.id, !on)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "text-slate-400 line-through hover:bg-slate-50"} disabled:cursor-default`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: l.color ?? "#94a3b8" }} />
            {l.name}
          </button>
        );
      })}
    </div>
  );
}
