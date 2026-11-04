"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// in-app replacements for window.alert / confirm / prompt

type ConfirmOpts = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // red confirm button for destructive actions
  danger?: boolean;
};

type PromptOpts = ConfirmOpts & {
  defaultValue?: string;
  placeholder?: string;
  // confirm stays disabled until the input equals this exactly
  match?: string;
  // show a selectable value only (e.g. a link to copy)
  readOnly?: boolean;
};

type DialogReq =
  | { id: number; kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { id: number; kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void };

type ToastKind = "info" | "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string };

// tiny module store so dialogs can be opened from any handler
let seq = 0;
let dialogs: DialogReq[] = [];
let toasts: Toast[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));

// resolves true when the user confirms
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    dialogs = [...dialogs, { id: ++seq, kind: "confirm", opts, resolve }];
    emit();
  });
}

// resolves the typed value, or null when cancelled
export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    dialogs = [...dialogs, { id: ++seq, kind: "prompt", opts, resolve }];
    emit();
  });
}

// non-blocking notice in the corner
export function toast(message: string, kind: ToastKind = "info") {
  const id = ++seq;
  toasts = [...toasts, { id, kind, message }];
  emit();
  setTimeout(() => dismissToast(id), kind === "error" ? 6000 : 3500);
}

function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function closeDialog(id: number) {
  dialogs = dialogs.filter((d) => d.id !== id);
  emit();
}

// shorthand for catch handlers
export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : String(e), "error");

// mounted once in the root layout
export function DialogHost() {
  const ds = useSyncExternalStore(subscribe, () => dialogs, () => dialogs);
  const ts = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  // only the newest dialog is interactive
  const top = ds[ds.length - 1];
  return (
    <>
      {top && <DialogBox key={top.id} req={top} />}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {ts.map((t) => <ToastItem key={t.id} t={t} />)}
      </div>
    </>
  );
}

function DialogBox({ req }: { req: DialogReq }) {
  const { opts } = req;
  const isPrompt = req.kind === "prompt";
  const p = opts as PromptOpts;
  const [value, setValue] = useState(isPrompt ? p.defaultValue ?? "" : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const blocked = isPrompt && p.match != null && value !== p.match;

  // settle the promise and drop the dialog
  function finish(ok: boolean) {
    closeDialog(req.id);
    if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok ? value : null);
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // focus input (selected) or the confirm button
  useEffect(() => {
    if (inputRef.current) inputRef.current.select();
    else okRef.current?.focus();
  }, []);

  // escape cancels; capture phase so the modal underneath stays open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      finishRef.current(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const readOnly = isPrompt && p.readOnly;
  const okLabel = opts.confirmLabel ?? (readOnly ? "Tutup" : opts.danger ? "Hapus" : "OK");

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/40 p-4 pt-[18vh] backdrop-blur-[1px]" onMouseDown={() => finish(false)}>
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`dlg-${req.id}`}
        className="w-full max-w-sm animate-[pop_140ms_ease-out] rounded-xl border border-slate-200 bg-surface p-5 text-slate-800 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) finish(true);
        }}
      >
        {/* header with icon */}
        <div className="flex gap-3">
          {opts.danger && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 7v4M10 14h.01M8.6 3.4 2.3 14.5A1.6 1.6 0 0 0 3.7 17h12.6a1.6 1.6 0 0 0 1.4-2.5L11.4 3.4a1.6 1.6 0 0 0-2.8 0Z" /></svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={`dlg-${req.id}`} className="text-base font-semibold text-slate-900">{opts.title}</h2>
            {opts.message && <div className="mt-1 text-sm break-words text-slate-600">{opts.message}</div>}
          </div>
        </div>

        {/* prompt input */}
        {isPrompt && (
          <input
            ref={inputRef}
            value={value}
            readOnly={readOnly}
            placeholder={p.placeholder ?? p.match}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => readOnly && e.target.select()}
            className="mt-4 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        )}

        {/* actions */}
        <div className="mt-5 flex justify-end gap-2">
          {!readOnly && (
            <button type="button" onClick={() => finish(false)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              {opts.cancelLabel ?? "Batal"}
            </button>
          )}
          <button
            ref={okRef}
            type="submit"
            disabled={blocked}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${opts.danger ? "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {okLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// one toast row; click to dismiss
function ToastItem({ t }: { t: Toast }) {
  const tone = t.kind === "error" ? "text-red-600" : t.kind === "success" ? "text-green-700" : "text-blue-600";
  return (
    <div
      role={t.kind === "error" ? "alert" : "status"}
      onClick={() => dismissToast(t.id)}
      className="pointer-events-auto flex cursor-pointer animate-[pop_140ms_ease-out] items-start gap-2.5 rounded-lg border border-slate-200 bg-surface px-3.5 py-2.5 text-sm text-slate-800 shadow-lg"
    >
      <span className={`mt-0.5 shrink-0 ${tone}`}>
        {t.kind === "error" ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v4M10 13.5h.01" /></svg>
        ) : t.kind === "success" ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5" /><path d="m6.8 10.2 2.2 2.2 4.2-4.6" /></svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.5h.01" /></svg>
        )}
      </span>
      <span className="min-w-0 flex-1 break-words">{t.message}</span>
    </div>
  );
}
