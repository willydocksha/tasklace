"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; w: number; h: number };
type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_W = 520;
const MIN_H = 360;
const GAP = 16;

// default floating rect: centered, as wide as `width` allows
function initialRect(width: number, key?: string): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = width;
  let h = vh - 64;
  // restore last size for this modal
  if (key) {
    try {
      const saved = JSON.parse(localStorage.getItem(`modal-size:${key}`) ?? "null");
      if (saved?.w && saved?.h) ({ w, h } = saved);
    } catch {}
  }
  w = Math.max(MIN_W, Math.min(w, vw - GAP * 2));
  h = Math.max(MIN_H, Math.min(h, vh - GAP * 2));
  return { x: (vw - w) / 2, y: Math.max(GAP, (vh - h) / 2), w, h };
}

// keep the panel on screen
function clamp(r: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(MIN_W, Math.min(r.w, vw - GAP * 2));
  const h = Math.max(MIN_H, Math.min(r.h, vh - GAP * 2));
  return { w, h, x: Math.min(Math.max(r.x, GAP - w + 120), vw - 120), y: Math.min(Math.max(r.y, 0), vh - 48) };
}

// resize handle placement per direction
const HANDLES: [Dir, string][] = [
  ["n", "top-0 left-3 right-3 h-1.5 cursor-ns-resize"],
  ["s", "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize"],
  ["e", "right-0 top-3 bottom-3 w-1.5 cursor-ew-resize"],
  ["w", "left-0 top-3 bottom-3 w-1.5 cursor-ew-resize"],
  ["ne", "top-0 right-0 h-3 w-3 cursor-nesw-resize"],
  ["sw", "bottom-0 left-0 h-3 w-3 cursor-nesw-resize"],
  ["nw", "top-0 left-0 h-3 w-3 cursor-nwse-resize"],
  ["se", "bottom-0 right-0 h-3 w-3 cursor-nwse-resize"],
];

// `floating` makes the panel draggable (by any [data-drag-handle]) and resizable from its edges
export function Modal({ onClose, children, width = 640, floating, sizeKey }: {
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  floating?: boolean;
  // localStorage key to remember the floating size
  sizeKey?: string;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rectRef = useRef<Rect | null>(null);
  rectRef.current = rect;

  // close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // floating only on wide screens; re-clamp when the window changes (layout effect avoids a flash of the classic modal)
  useLayoutEffect(() => {
    if (!floating) return;
    const sync = () => setRect((r) => (window.innerWidth < 768 ? null : r ? clamp(r) : initialRect(width, sizeKey)));
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [floating, width, sizeKey]);

  // shared pointer loop for move and resize
  function track(e: React.PointerEvent, apply: (start: Rect, dx: number, dy: number) => Rect) {
    const start = rectRef.current;
    if (!start) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => setRect(clamp(apply(start, ev.clientX - sx, ev.clientY - sy)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      // remember size
      const r = rectRef.current;
      if (sizeKey && r) try { localStorage.setItem(`modal-size:${sizeKey}`, JSON.stringify({ w: r.w, h: r.h })); } catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // drag from a handle area, but not from its inputs/buttons
  function onDragStart(e: React.PointerEvent) {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || !t.closest("[data-drag-handle]") || t.closest("input,textarea,button,select,a,[contenteditable=true]")) return;
    track(e, (s, dx, dy) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  }

  // double-click a handle to re-center at default size
  function onReset(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest("[data-drag-handle]") || t.closest("input,textarea,button,select,a")) return;
    if (sizeKey) try { localStorage.removeItem(`modal-size:${sizeKey}`); } catch {}
    setRect(initialRect(width));
  }

  // grow/shrink from the given edge(s)
  function onResizeStart(e: React.PointerEvent, d: Dir) {
    e.stopPropagation();
    track(e, (s, dx, dy) => {
      const r = { ...s };
      if (d.includes("e")) r.w = Math.max(MIN_W, s.w + dx);
      if (d.includes("s")) r.h = Math.max(MIN_H, s.h + dy);
      if (d.includes("w")) { r.w = Math.max(MIN_W, s.w - dx); r.x = s.x + s.w - r.w; }
      if (d.includes("n")) { r.h = Math.max(MIN_H, s.h - dy); r.y = s.y + s.h - r.h; }
      return r;
    });
  }

  // floating panel
  if (floating && rect) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={onClose}>
        <div
          className="fixed flex flex-col rounded-xl bg-surface shadow-2xl"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={onDragStart}
          onDoubleClick={onReset}
        >
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl">{children}</div>
          {HANDLES.map(([d, cls]) => <div key={d} className={`absolute z-20 ${cls}`} onPointerDown={(e) => onResizeStart(e, d)} />)}
          {/* visible grip in the corner */}
          <svg viewBox="0 0 10 10" className="pointer-events-none absolute right-1 bottom-1 z-10 h-2.5 w-2.5 text-slate-400"><path d="M9 3 3 9M9 6 6 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </div>
      </div>
    );
  }

  // classic centered modal (also floating fallback on small screens)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10" onMouseDown={onClose}>
      <div className="w-full rounded-xl bg-surface shadow-2xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
