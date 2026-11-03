"use client";
import type { Activity, Card, List } from "@/lib/types";

type Step = { list: List; state: "current" | "visited" | "skipped" | "upcoming"; enteredAt?: number; spent?: number; visits: number };

// "2h 3j", "45m", "< 1m"
export function duration(ms: number) {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "< 1m";
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return h ? `${d}h ${h}j` : `${d}h`;
  if (h) return mm ? `${h}j ${mm}m` : `${h}j`;
  return `${mm}m`;
}
const stamp = (ts: number) => new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// replay status moves into per-list visits (entered time + total time spent)
function journey(card: Card, lists: List[], activity: Activity[]): Step[] {
  const moves = activity.filter((a) => a.kind === "status");
  const created = activity.find((a) => a.kind === "created");
  // the list the card started in (older cards have no "created" row)
  const first = (created?.data.to as string) ?? (moves[0]?.data.from as string) ?? card.list_id;
  const segs: { list: string; from: number; to: number }[] = [];
  let cur = { list: first, from: created?.created_at ?? card.created_at };
  for (const m of moves) {
    segs.push({ ...cur, to: m.created_at });
    cur = { list: m.data.to as string, from: m.created_at };
  }
  segs.push({ ...cur, to: Date.now() });

  const curIdx = lists.findIndex((l) => l.id === card.list_id);
  return lists.map((list, i) => {
    const mine = segs.filter((s) => s.list === list.id);
    if (list.id === card.list_id) return { list, state: "current", enteredAt: mine.at(-1)?.from, spent: mine.reduce((t, s) => t + s.to - s.from, 0), visits: mine.length };
    if (mine.length) return { list, state: "visited", enteredAt: mine[0].from, spent: mine.reduce((t, s) => t + s.to - s.from, 0), visits: mine.length };
    return { list, state: i < curIdx ? "skipped" : "upcoming", visits: 0 };
  });
}

// vertical stepper of every status, newest stage on top
export function StatusJourney({ card, lists, activity }: { card: Card; lists: List[]; activity: Activity[] }) {
  const steps = journey(card, lists, activity).reverse();
  const done = !!lists.find((l) => l.id === card.list_id)?.is_done;

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const next = steps[i + 1];
        // solid green rail between two reached stages, dashed otherwise
        const reached = (x?: Step) => x && (x.state === "visited" || x.state === "current");
        const rail = reached(s) && reached(next);
        const isCur = s.state === "current";
        return (
          <li key={s.list.id} className="relative flex gap-3 pb-4 last:pb-0">
            {next && <span className={`absolute top-8 bottom-0 left-[13px] w-0.5 ${rail ? "bg-green-500" : "border-l-2 border-dashed border-slate-200"}`} />}

            {/* node */}
            <span className="relative z-[1] mt-0.5 shrink-0">
              {s.state === "visited" || (isCur && done) ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              ) : isCur ? (
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 shadow-sm ring-4 ring-blue-100">
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-30" />
                  <span className="h-2.5 w-2.5 rounded-full bg-surface" />
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-surface text-xs text-slate-400">—</span>
              )}
            </span>

            {/* text */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`text-sm font-semibold ${s.state === "skipped" || s.state === "upcoming" ? "text-slate-400" : "text-slate-800"}`}>{s.list.name}</span>
                {isCur && <span className={`rounded-md px-1.5 py-px text-[11px] font-semibold ${done ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{done ? "Selesai" : "Sekarang"}</span>}
                {s.state === "skipped" && <span className="text-xs font-medium text-slate-400">Dilewati</span>}
                {s.visits > 1 && <span className="text-[11px] text-slate-400">{s.visits}× masuk</span>}
              </div>
              {s.enteredAt && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                  <span>{stamp(s.enteredAt)}</span>
                  {s.spent !== undefined && !(isCur && done) && (
                    <span className="inline-flex items-center gap-1" title={isCur ? "Sudah berapa lama di status ini" : "Total waktu di status ini"}>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6" /><path d="M8 5v3.2l2 1.3" strokeLinecap="round" /></svg>
                      {isCur ? `${duration(s.spent)} berjalan` : duration(s.spent)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
