"use client";
import { autoUpdate, flip, offset, shift, useFloating, type Placement } from "@floating-ui/react-dom";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client";

// one step: points at [data-tour=target] (or sits centered without a target)
// placement: where the card sits next to the target (default below; tall targets read better on the side)
export type TourStep = { target?: string; title: string; body: React.ReactNode; placement?: Placement };

// tours finished in this tab, so a remounted tour (e.g. the card modal) doesn't show again
const seenHere = new Set<string>();
const REPLAY = "tl-tour-replay";

// ask every mounted tour to start over (used by the profile menu)
export const replayTours = () => window.dispatchEvent(new Event(REPLAY));

const PAD = 6;

// spotlight walkthrough shown the first time a user sees a page; enabled=false holds it back
export function Tour({ id, steps, seen, enabled = true, delay = 500 }: { id: string; steps: TourStep[]; seen: string[]; enabled?: boolean; delay?: number }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [live, setLive] = useState<TourStep[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // only steps whose target is on screen right now (e.g. no board yet = skip the board tile)
  const present = useCallback(() => steps.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`)), [steps]);

  // start once, after the page has settled
  useEffect(() => {
    if (!enabled || open || seen.includes(id) || seenHere.has(id)) return;
    const t = setTimeout(() => {
      const ok = present();
      if (!ok.length) return;
      setLive(ok);
      setI(0);
      setOpen(true);
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, open, seen, id, present, delay]);

  // replay from the profile menu
  useEffect(() => {
    const onReplay = () => {
      if (!enabled) return;
      const ok = present();
      if (!ok.length) return;
      setLive(ok);
      setI(0);
      setOpen(true);
    };
    window.addEventListener(REPLAY, onReplay);
    return () => window.removeEventListener(REPLAY, onReplay);
  }, [enabled, present]);

  const step = open ? live[i] : undefined;
  const el = step?.target ? (document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null) : null;

  // scroll the target into view, then follow it while the page moves
  useLayoutEffect(() => {
    if (!el) return setRect(null);
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    let raf = 0;
    const tick = () => {
      setRect((prev) => {
        const r = el.getBoundingClientRect();
        return prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [el]);

  // close and remember (finished or skipped both count as seen)
  const done = useCallback(() => {
    setOpen(false);
    if (seenHere.has(id) || seen.includes(id)) return;
    seenHere.add(id);
    api("/api/profile/tours", "POST", { id }).catch(() => {});
  }, [id, seen]);

  const next = useCallback(() => (i < live.length - 1 ? setI(i + 1) : done()), [i, live.length, done]);
  const back = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  // keys: arrows to move, esc to skip; captured so the modal behind doesn't close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!["Escape", "ArrowRight", "ArrowLeft", "Enter"].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") done();
      else if (e.key === "ArrowLeft") back();
      else next();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, next, back, done]);

  // tooltip anchored to the spotlight box
  const fl = useFloating({
    placement: step?.placement ?? "bottom",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(14), flip({ padding: 12, fallbackPlacements: ["top", "right", "left"] }), shift({ padding: 12 })],
  });
  const { setReference } = fl.refs;
  useLayoutEffect(() => {
    setReference(rect ? { getBoundingClientRect: () => rect } : null);
  }, [rect, setReference]);

  if (!step) return null;
  const box = rect && { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
  const centered = !step.target || !rect;

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* dim layer: a spotlight box with a huge shadow, or a plain backdrop for centered steps */}
      {box && !centered ? (
        <div className="pointer-events-none fixed rounded-xl ring-2 ring-white/80 transition-all duration-300 ease-out" style={{ ...box, boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)" }} />
      ) : (
        <div className="fixed inset-0 bg-slate-900/60" />
      )}
      {/* clicks outside the card do nothing (no accidental actions mid-tour) */}
      <div className="fixed inset-0" onMouseDown={(e) => e.stopPropagation()} />

      <div
        ref={fl.refs.setFloating}
        style={centered ? { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)" } : { position: "fixed", left: fl.x ?? 0, top: fl.y ?? 0 }}
        className="w-[min(360px,calc(100vw-24px))] animate-[pop_160ms_ease-out] rounded-xl bg-surface p-4 text-slate-800 shadow-2xl ring-1 ring-black/5"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{i + 1} / {live.length}</span>
          <button onClick={done} className="ml-auto text-xs text-slate-400 hover:text-slate-700">Lewati tutorial</button>
        </div>
        <h3 className="mb-1 text-base font-bold">{step.title}</h3>
        <div className="text-sm leading-relaxed text-slate-600">{step.body}</div>
        {/* progress dots + nav */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1">
            {live.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-blue-600" : "w-1.5 bg-slate-300"}`} />)}
          </div>
          <div className="ml-auto flex gap-1.5">
            {i > 0 && <button onClick={back} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Kembali</button>}
            <button autoFocus onClick={next} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-500">
              {i < live.length - 1 ? "Lanjut" : "Selesai 🎉"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
