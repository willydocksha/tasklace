"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { compressCanvas } from "@/lib/image";

const VIEW = 288; // crop box size in css px
const OUT = 256; // exported avatar size
const MAX_BYTES = 40 * 1024; // target file size after compression
const MAX_ZOOM = 4;

type View = { x: number; y: number; zoom: number };

// circular crop editor: drag to move, wheel/pinch/slider to zoom, rotate 90°
export function PhotoCropper({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (blob: Blob) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rot, setRot] = useState(0);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // image size after rotation and the zoom-1 scale that just covers the box
  const w = bitmap ? (rot % 2 ? bitmap.height : bitmap.width) : 1;
  const h = bitmap ? (rot % 2 ? bitmap.width : bitmap.height) : 1;
  const base = VIEW / Math.min(w, h);

  // keep zoom in range and the image covering the whole box
  const clamp = useCallback(
    (v: View): View => {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
      const s = base * zoom;
      return { zoom, x: Math.min(0, Math.max(VIEW - w * s, v.x)), y: Math.min(0, Math.max(VIEW - h * s, v.y)) };
    },
    [base, w, h],
  );

  // zoom so the point p (box coords) stays under the cursor/fingers
  const zoomAt = useCallback(
    (v: View, zoom: number, p = { x: VIEW / 2, y: VIEW / 2 }) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
      const r = z / v.zoom;
      return clamp({ zoom: z, x: p.x - (p.x - v.x) * r, y: p.y - (p.y - v.y) * r });
    },
    [clamp],
  );

  // decode the picked file
  useEffect(() => {
    let bm: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((b) => setBitmap((bm = b)))
      .catch(() => setError("File ini tidak bisa dibuka sebagai gambar."));
    return () => bm?.close();
  }, [file]);

  // center the image whenever it loads or rotates
  useEffect(() => {
    if (bitmap) setView({ zoom: 1, x: (VIEW - w * base) / 2, y: (VIEW - h * base) / 2 });
  }, [bitmap, rot, w, h, base]);

  // paint the current framing onto a square canvas of the given size
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (!bitmap) return;
      const k = size / VIEW;
      const s = base * view.zoom;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingQuality = "high";
      ctx.setTransform(k * s, 0, 0, k * s, k * view.x, k * view.y);
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rot * Math.PI) / 2);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    },
    [bitmap, base, view, rot, w, h],
  );

  // redraw the preview (sharp on retina)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = Math.round(VIEW * dpr);
    paint(c.getContext("2d")!, c.width);
  }, [paint]);

  // wheel zoom needs a non-passive listener to block page scroll
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      setView((v) => zoomAt(v, v.zoom * Math.exp(-e.deltaY * 0.002), p));
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [zoomAt, bitmap]);

  // drag with one pointer, pinch with two
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (map.size === 1) {
      setView((v) => clamp({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
    } else if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(cur.x - other.x, cur.y - other.y);
      const r = e.currentTarget.getBoundingClientRect();
      const mid = { x: (cur.x + other.x) / 2 - r.left, y: (cur.y + other.y) / 2 - r.top };
      if (before > 0) setView((v) => zoomAt(v, v.zoom * (after / before), mid));
    }
    map.set(e.pointerId, cur);
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
  }

  // arrow keys nudge, +/- zoom
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (e.key === "+" || e.key === "=") setView((v) => zoomAt(v, v.zoom * 1.1));
    else if (e.key === "-") setView((v) => zoomAt(v, v.zoom / 1.1));
  }

  // render the final square and hand it to the parent
  async function save() {
    const c = document.createElement("canvas");
    c.width = c.height = OUT;
    paint(c.getContext("2d")!, OUT);
    setBusy(true);
    try {
      await onSave(await compressCanvas(c, MAX_BYTES));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? () => {} : onCancel} width={400}>
      <div className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Atur foto profil</h2>
        <p className="mt-0.5 text-sm text-slate-500">Geser untuk memposisikan, scroll atau cubit untuk zoom.</p>

        {/* crop box */}
        <div className="relative mx-auto mt-4 overflow-hidden rounded-xl bg-slate-900" style={{ width: VIEW, height: VIEW }}>
          {error ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">{error}</p>
          ) : !bitmap ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-400">Memuat…</p>
          ) : null}
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Area potong foto"
            className={`absolute inset-0 cursor-grab touch-none outline-none active:cursor-grabbing ${bitmap && !error ? "" : "invisible"}`}
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          />
          {/* dim outside the circle + thirds grid */}
          {bitmap && !error && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 ring-white/80" />
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />
            </div>
          )}
        </div>

        {/* zoom + rotate */}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" aria-label="Perkecil" disabled={!bitmap} onClick={() => setView((v) => zoomAt(v, v.zoom / 1.2))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40">
            −
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            disabled={!bitmap}
            aria-label="Zoom"
            onChange={(e) => setView((v) => zoomAt(v, Number(e.target.value)))}
            className="h-1.5 flex-1 cursor-pointer accent-blue-600"
          />
          <button type="button" aria-label="Perbesar" disabled={!bitmap} onClick={() => setView((v) => zoomAt(v, v.zoom * 1.2))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40">
            +
          </button>
          <button type="button" aria-label="Putar 90°" title="Putar 90°" disabled={!bitmap} onClick={() => setRot((r) => (r + 1) % 4)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* actions */}
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onCancel} disabled={busy} className="h-9 rounded-lg border border-slate-200 bg-surface px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
          Batal
        </button>
        <button type="button" onClick={save} disabled={!bitmap || !!error || busy} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 dark:hover:bg-blue-500">
          {busy ? "Menyimpan…" : "Simpan foto"}
        </button>
      </div>
    </Modal>
  );
}
