"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { PhotoCropper } from "@/components/PhotoCropper";
import { Icon } from "@/components/ui/Icon";
import { TeamAvatar } from "@/components/TeamAvatar";
import { api } from "@/lib/client";
import { isAdminRole } from "@/lib/permissions";
import { BoardBadge } from "@/components/BoardLook";

type MyBoard = { id: string; name: string; color: string; background: string | null; icon: string | null; role: string };

const MAX_NAME = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// new-team form: name, boards to share and people to add, all in one go
export function CreateTeamModal({ myBoards, onClose, onCreated }: { myBoards: MyBoard[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [boardIds, setBoardIds] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // set after creation when some emails could not be added
  const [done, setDone] = useState<{ id: string; failed: string[] } | null>(null);
  // picked photo: file being cropped, then the cropped blob and its preview url
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // free the preview url when it changes or the form closes
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  // only boards the user administers can be shared
  const shareable = myBoards.filter((b) => isAdminRole(b.role));

  // turn typed text into email chips; returns false when something is invalid
  function commit(text = draft) {
    const parts = text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    const good = parts.filter((p) => EMAIL_RE.test(p) && !emails.includes(p));
    if (good.length) setEmails((list) => [...list, ...good.filter((g, i) => good.indexOf(g) === i)]);
    setDraft(bad.join(" "));
    setError(bad.length ? `Email tidak valid: ${bad.join(", ")}` : "");
    return !bad.length;
  }

  // create the team, then share boards and add members in parallel
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (draft.trim() && !commit())) return;
    setBusy(true);
    setError("");
    try {
      // include a still-typed email that was not turned into a chip yet
      const all = [...new Set([...emails, ...draft.trim().toLowerCase().split(/[\s,;]+/).filter(Boolean)])];
      const { id } = await api<{ id: string }>("/api/teams", "POST", { name: name.trim() });
      // photo upload failing should not block the rest; it can be set again later
      if (photo) await fetch(`/api/teams/${id}/avatar`, { method: "PUT", headers: { "content-type": photo.blob.type }, body: photo.blob }).catch(() => {});
      await Promise.all(boardIds.map((boardId) => api(`/api/teams/${id}/boards`, "POST", { boardId }).catch(() => {})));
      const results = await Promise.all(all.map((email) => api(`/api/teams/${id}/members`, "POST", { email }).then(() => null, () => email)));
      const failed = results.filter((x): x is string => !!x);
      if (failed.length) setDone({ id, failed });
      else onCreated(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // follow-up screen: team exists, some emails are not registered yet
  if (done) {
    return (
      <Modal onClose={() => onCreated(done.id)} width={460}>
        <div className="space-y-4 p-6">
          <h2 className="flex items-center gap-1.5 text-lg font-bold"><Icon name="check" className="h-5 w-5 text-green-600" />Tim “{name.trim()}” dibuat</h2>
          <p className="text-sm text-slate-600">Email berikut belum punya akun, jadi belum bisa ditambahkan langsung. Kirim link undangan tim ke mereka:</p>
          <ul className="flex flex-wrap gap-1.5">
            {done.failed.map((m) => <li key={m} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">{m}</li>)}
          </ul>
          <div className="flex justify-end">
            <button onClick={() => onCreated(done.id)} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-500">Buka tim & salin link</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width={480}>
      <form onSubmit={submit} className="space-y-5 p-6">
        {/* header: team photo (click to pick) with live preview */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0 rounded-2xl" title="Pilih foto tim">
            <TeamAvatar name={name.trim() || "?"} src={photo?.url} size={64} />
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100"><span className="inline-flex items-center gap-1"><Icon name="camera" className="h-3.5 w-3.5" />Foto</span></span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{name.trim() || "Tim baru"}</h2>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => fileRef.current?.click()} className="text-blue-600 hover:underline">{photo ? "Ganti foto" : "Unggah foto tim"}</button>
              {photo && <button type="button" onClick={() => setPhoto(null)} className="text-slate-500 hover:text-red-600 hover:underline">Hapus</button>}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCropFile(f); }} />
        </div>

        {/* team name */}
        <label className="block">
          <div className="mb-1.5 flex justify-between text-sm font-medium text-slate-600">
            <span>Nama tim <span className="text-red-500">*</span></span>
            <span className={`text-xs font-normal ${name.length >= MAX_NAME ? "text-red-500" : "text-slate-400"}`}>{name.length}/{MAX_NAME}</span>
          </div>
          <input autoFocus required maxLength={MAX_NAME} className="w-full rounded-lg border px-3 py-2" placeholder="mis. Tim Marketing, Squad Mobile" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        {/* boards to share right away */}
        {shareable.length > 0 && (
          <div>
            <div className="mb-1.5 flex justify-between text-sm font-medium text-slate-600">
              <span>Bagikan board <span className="font-normal text-slate-400">(opsional)</span></span>
              {boardIds.length > 0 && <span className="text-xs font-normal text-slate-400">{boardIds.length} dipilih</span>}
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1.5">
              {shareable.map((b) => {
                const on = boardIds.includes(b.id);
                return (
                  <label key={b.id} className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${on ? "bg-blue-50 dark:bg-blue-500/15" : "hover:bg-slate-50"}`}>
                    <input type="checkbox" checked={on} onChange={() => setBoardIds((ids) => (on ? ids.filter((x) => x !== b.id) : [...ids, b.id]))} className="accent-blue-600" />
                    <BoardBadge board={b} className="h-4 w-6 rounded" iconClass="h-3 w-3" />
                    <span className="truncate">{b.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* members by email, as chips */}
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-600">
            Tambah member <span className="font-normal text-slate-400">(opsional)</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/40">
            {emails.map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-1 pl-2.5 text-xs">
                {m}
                <button type="button" onClick={() => setEmails((l) => l.filter((x) => x !== m))} className="rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`Hapus ${m}`}><Icon name="x" className="h-3 w-3" /></button>
              </span>
            ))}
            <input
              type="text"
              inputMode="email"
              className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
              placeholder={emails.length ? "" : "email@contoh.com, pisahkan dengan koma"}
              value={draft}
              onChange={(e) => (/[,;\s]$/.test(e.target.value) ? commit(e.target.value) : setDraft(e.target.value))}
              onKeyDown={(e) => {
                // enter adds a chip instead of submitting while typing an email
                if (e.key === "Enter" && draft.trim()) { e.preventDefault(); commit(); }
                // backspace on empty input removes the last chip
                if (e.key === "Backspace" && !draft && emails.length) setEmails((l) => l.slice(0, -1));
              }}
              onBlur={() => draft.trim() && commit()}
              onPaste={(e) => { e.preventDefault(); commit(draft + " " + e.clipboardData.getData("text")); }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Hanya untuk user yang sudah terdaftar. Yang belum, undang lewat link tim setelah tim dibuat.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* actions */}
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <span className="mr-auto text-xs text-slate-500">Kamu otomatis jadi owner tim.</span>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100">Batal</button>
          <button disabled={busy || !name.trim()} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-500">
            {busy ? "Membuat…" : "Buat tim"}
          </button>
        </div>
      </form>
      {/* crop the picked photo; kept locally until the team exists */}
      {cropFile && <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={async (blob) => { setPhoto({ blob, url: URL.createObjectURL(blob) }); setCropFile(null); }} />}
    </Modal>
  );
}
