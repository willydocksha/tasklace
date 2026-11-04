"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDialog } from "@/components/ui/Dialog";
import { api } from "@/lib/client";
import { uploadCardImage } from "@/lib/image";
import type { Attachment, Card } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

type Pending = { key: string; name: string; step: string };

// human file size, e.g. 312 KB / 1,2 MB
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

// image attachments of a card: pick, drop or paste; compressed before upload
export function Attachments({ card, locked, onChanged }: { card: Card; locked: boolean; onChanged: () => void }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // reload whenever the card changes (own edits or realtime refresh)
  const load = useCallback(() => api<Attachment[]>(`/api/cards/${card.id}/attachments`).then(setItems), [card.id]);
  useEffect(() => {
    void load();
  }, [card, load]);

  // compress + upload files one by one, showing a placeholder for each
  const upload = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (!images.length) return setError("Hanya file gambar yang bisa dilampirkan.");
      setError(null);
      const jobs = images.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name || "gambar", step: "Menunggu…" }));
      setPending((p) => [...p, ...jobs]);
      const step = (key: string, s: string) => setPending((p) => p.map((j) => (j.key === key ? { ...j, step: s } : j)));
      for (const [i, f] of images.entries()) {
        const job = jobs[i];
        try {
          await uploadCardImage(card.id, f, (st) => step(job.key, st));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setPending((p) => p.filter((j) => j.key !== job.key));
        }
      }
      await load();
      onChanged();
    },
    [card.id, load, onChanged],
  );

  // paste an image anywhere in the open card
  useEffect(() => {
    if (locked) return;
    const onPaste = (e: ClipboardEvent) => {
      // the description editor already took it (inline image)
      if (e.defaultPrevented) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      void upload(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [locked, upload]);

  async function remove(a: Attachment) {
    if (!(await confirmDialog({ title: `Hapus lampiran "${a.name}"?`, danger: true }))) return;
    try {
      await api(`/api/attachments/${a.id}`, "DELETE");
      setView(null);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const lbl = "mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase";
  const empty = !items.length && !pending.length;
  if (locked && empty) return null;

  return (
    <div
      onDragOver={(e) => {
        if (locked || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrag(false)}
      onDrop={(e) => {
        if (locked) return;
        e.preventDefault();
        setDrag(false);
        void upload([...e.dataTransfer.files]);
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <span className={lbl}>Lampiran{items.length > 0 && ` · ${items.length}`}</span>
        {!locked && !empty && (
          <button onClick={() => fileRef.current?.click()} className="mb-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
            + Tambah gambar
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void upload(f); }} />

      {empty ? (
        // empty dropzone
        <button onClick={() => fileRef.current?.click()} className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition ${drag ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
          <Icon name="image" className="h-5 w-5" />
          <span><b className="font-medium">Pilih gambar</b>, tarik ke sini, atau tempel (Ctrl/⌘+V)</span>
          <span className="text-xs text-slate-400">Otomatis dikompres sebelum diunggah</span>
        </button>
      ) : (
        // thumbnail grid
        <div className={`grid grid-cols-3 gap-2 rounded-xl transition sm:grid-cols-4 ${drag ? "bg-blue-50 ring-2 ring-blue-400 ring-offset-4" : ""}`}>
          {items.map((a, i) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
              <button onClick={() => setView(i)} className="block h-full w-full" title={a.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/attachments/${a.id}?thumb=1`} alt={a.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              </button>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                {a.name} · {fmtSize(a.size)}
              </span>
              {!locked && (
                <button onClick={() => remove(a)} aria-label={`Hapus ${a.name}`} className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600 focus:opacity-100">
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.key} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg bg-slate-50 p-2 text-center ring-1 ring-slate-200">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              <span className="text-[11px] text-slate-500">{p.step}</span>
              <span className="w-full truncate text-[10px] text-slate-400">{p.name}</span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {view !== null && items[view] && <Lightbox items={items} index={view} onIndex={setView} onClose={() => setView(null)} onDelete={locked ? undefined : remove} />}
    </div>
  );
}

// full-size viewer with prev/next; esc closes only the viewer, not the card
function Lightbox({ items, index, onIndex, onClose, onDelete }: {
  items: Attachment[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete?: (a: Attachment) => void;
}) {
  const a = items[index];
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);

  // capture phase so the card modal's esc handler never sees it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else return;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, onClose]);

  const btn = "flex h-9 items-center justify-center rounded-full bg-white/10 px-3 text-sm text-white transition hover:bg-white/20";
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" onMouseDown={onClose}>
      {/* top bar */}
      <div className="flex items-center gap-3 p-3 text-white" onMouseDown={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{a.name}</div>
          <div className="text-xs text-white/60">
            {a.width}×{a.height} · {fmtSize(a.size)}
            {a.user_name && ` · ${a.user_name}`}
            {items.length > 1 && ` · ${index + 1}/${items.length}`}
          </div>
        </div>
        <a href={`/api/attachments/${a.id}?download=1`} download={a.name} className={btn}>Unduh</a>
        {onDelete && <button onClick={() => onDelete(a)} className={`${btn} hover:bg-red-600`}>Hapus</button>}
        <button onClick={onClose} aria-label="Tutup" className={`${btn} w-9 px-0`}><Icon name="x" /></button>
      </div>

      {/* image + arrows */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={a.id} src={`/api/attachments/${a.id}`} alt={a.name} className="max-h-full max-w-full rounded object-contain shadow-2xl" onMouseDown={(e) => e.stopPropagation()} />
        {items.length > 1 && (
          <>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => go(-1)} aria-label="Sebelumnya" className={`${btn} absolute top-1/2 left-3 h-11 w-11 -translate-y-1/2 px-0 text-xl`}>‹</button>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => go(1)} aria-label="Berikutnya" className={`${btn} absolute top-1/2 right-3 h-11 w-11 -translate-y-1/2 px-0 text-xl`}>›</button>
          </>
        )}
      </div>
    </div>
  );
}
