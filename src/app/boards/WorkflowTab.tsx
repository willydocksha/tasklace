"use client";
import { useCallback, useEffect, useState } from "react";
import { FlowEditor, SubtaskStatusPicker, type FlowMap } from "@/components/FlowEditor";
import { confirmDialog, toast, toastError } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/client";
import type { WorkflowStatus } from "@/lib/workflow";

type Wf = { id: string; name: string; statuses: WorkflowStatus[]; subtask_own_flow: boolean; boards: { id: string; name: string }[] };
type TeamBoard = { id: string; name: string };
type Sync = { board: string; created: number; removed: number; kept: string[] };

// team workflows: one set of statuses and flows, kept in sync on every linked board
export function WorkflowTab({ teamId, admin, boards, onChanged }: { teamId: string; admin: boolean; boards: TeamBoard[]; onChanged: () => void }) {
  const [list, setList] = useState<Wf[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");

  const load = useCallback(() => api<Wf[]>(`/api/teams/${teamId}/workflows`).then(setList).catch(toastError), [teamId]);
  useEffect(() => {
    void load();
  }, [load]);

  // create a workflow, blank or copied from a board, and open it
  async function create() {
    if (!name.trim()) return;
    try {
      const { id } = await api<{ id: string }>(`/api/teams/${teamId}/workflows`, "POST", { name, fromBoard: from || undefined });
      setName("");
      setFrom("");
      await load();
      setOpen(id);
    } catch (e) {
      toastError(e);
    }
  }

  if (!list) return <div className="p-3 text-sm text-slate-400">Memuat…</div>;
  const current = list.find((w) => w.id === open);
  if (current) return <Editor key={current.id} wf={current} admin={admin} boards={boards} all={list} onBack={() => setOpen(null)} onSaved={async () => (await load(), onChanged())} />;

  return (
    <>
      <p className="text-xs text-slate-500">
        Alur kerja berisi daftar status, alur pindah kartu, dan aturan subtask. Pasang ke beberapa board sekaligus: kalau alur kerjanya diubah, semua board yang ikut langsung ikut berubah.
      </p>
      <div className="divide-y rounded-md border">
        {list.length === 0 && <div className="p-3 text-sm text-slate-400">Belum ada alur kerja.</div>}
        {list.map((w) => (
          <button key={w.id} onClick={() => setOpen(w.id)} className="flex w-full items-center gap-2.5 p-2.5 text-left hover:bg-slate-50">
            <Icon name="flow" className="h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{w.name}</div>
              <div className="truncate text-xs text-slate-500">{w.statuses.map((s) => s.name).join(" → ")}</div>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{w.boards.length} board</span>
            <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
      {admin && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-semibold">Alur kerja baru</div>
          <input className="w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Nama, mis. Alur Dev Squad" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          <div className="flex gap-2">
            {/* starting point: default statuses or a copy of a board's flow */}
            <Select
              value={from}
              onChange={setFrom}
              className="min-w-0 flex-1"
              searchable={boards.length > 6}
              options={[
                { value: "", label: "Mulai dari status standar", description: "Backlog → To Do → In Progress → Review → Done" },
                ...boards.map((b) => ({ value: b.id, label: `Salin dari ${b.name}`, description: "Status & alur dari board ini" })),
              ]}
            />
            <button disabled={!name.trim()} onClick={create} className="rounded-md bg-blue-600 px-3 text-sm text-white disabled:opacity-50">Buat</button>
          </div>
        </div>
      )}
    </>
  );
}

// edit one workflow locally, then save and push it to its boards
function Editor({ wf, admin, boards, all, onBack, onSaved }: { wf: Wf; admin: boolean; boards: TeamBoard[]; all: Wf[]; onBack: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(wf.name);
  const [st, setSt] = useState<WorkflowStatus[]>(wf.statuses);
  const [own, setOwn] = useState(wf.subtask_own_flow);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = name !== wf.name || own !== wf.subtask_own_flow || JSON.stringify(st) !== JSON.stringify(wf.statuses);
  const ro = !admin;

  // helpers to change one status or the whole list
  const upd = (key: string, p: Partial<WorkflowStatus>) => setSt((xs) => xs.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const move = (i: number, d: number) => setSt((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const next = [...xs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  // removing a status bridges its flow: whoever could move into it may now move where it led
  const remove = (key: string) => setSt((xs) => {
    const gone = xs.find((s) => s.key === key);
    const bridge = (ids: string[] | null, via: string[] | null, self: string) => {
      if (!ids?.includes(key)) return ids;
      if (!via) return null;
      return [...new Set([...ids.filter((k) => k !== key), ...via])].filter((k) => k !== self && k !== key);
    };
    return xs.filter((s) => s.key !== key).map((s) => ({ ...s, next: bridge(s.next, gone?.next ?? null, s.key), subtask_next: bridge(s.subtask_next, gone?.subtask_next ?? null, s.key) }));
  });
  function add() {
    const n = newName.trim();
    if (!n) return;
    if (st.some((s) => s.name.toLowerCase() === n.toLowerCase())) return toast(`Status "${n}" sudah ada`, "error");
    setSt((xs) => [...xs, { key: crypto.randomUUID(), name: n, color: null, is_done: false, subtask: true, next: null, subtask_next: null }]);
    setNewName("");
  }
  // apply flow changes from the shared editor
  const setFlow = (field: "next" | "subtask_next") => (c: FlowMap) => setSt((xs) => xs.map((s) => (s.key in c ? { ...s, [field]: c[s.key] } : s)));

  // tell what happened on each board after a sync
  function report(res: Sync[]) {
    const kept = res.filter((r) => r.kept.length);
    if (kept.length) toast(kept.map((r) => `${r.board}: list ${r.kept.map((k) => `"${k}"`).join(", ")} masih berisi kartu, dipindah ke paling kanan`).join(" · "), "info");
  }

  async function save() {
    setBusy(true);
    try {
      const r = await api<{ boards: Sync[] }>(`/api/workflows/${wf.id}`, "PUT", { name, statuses: st, subtask_own_flow: own });
      toast(r.boards.length ? `Tersimpan dan diterapkan ke ${r.boards.length} board` : "Tersimpan", "success");
      report(r.boards);
      await onSaved();
    } catch (e) {
      toastError(e);
    }
    setBusy(false);
  }

  // link or unlink a team board
  async function toggleBoard(b: TeamBoard, on: boolean) {
    if (on) {
      if (dirty) return toast("Simpan perubahan dulu sebelum memasang ke board", "error");
      const other = all.find((w) => w.id !== wf.id && w.boards.some((x) => x.id === b.id));
      const ok = await confirmDialog({
        title: `Pasang "${wf.name}" ke ${b.name}?`,
        message: `${other ? `Board ini sekarang ikut "${other.name}" dan akan pindah. ` : ""}List board disamakan dengan status alur kerja: list dengan nama sama dipakai ulang, yang belum ada dibuat, list kosong yang tidak ada di alur kerja dihapus. List yang masih berisi kartu tidak dihapus, hanya dipindah ke paling kanan.`,
        confirmLabel: "Pasang",
      });
      if (!ok) return;
    } else if (!(await confirmDialog({ title: `Lepas ${b.name} dari "${wf.name}"?`, message: "Status board tetap seperti sekarang, tapi tidak ikut berubah lagi.", confirmLabel: "Lepas" }))) return;
    try {
      if (on) report([{ board: b.name, ...(await api<Omit<Sync, "board">>(`/api/workflows/${wf.id}/boards`, "POST", { boardId: b.id })) }]);
      else await api(`/api/workflows/${wf.id}/boards/${b.id}`, "DELETE");
      await onSaved();
    } catch (e) {
      toastError(e);
    }
  }

  async function del() {
    if (!(await confirmDialog({ title: `Hapus alur kerja "${wf.name}"?`, message: "Board yang ikut tetap memakai status sekarang, hanya tidak tersinkron lagi.", danger: true, confirmLabel: "Hapus" }))) return;
    try {
      await api(`/api/workflows/${wf.id}`, "DELETE");
      await onSaved();
      onBack();
    } catch (e) {
      toastError(e);
    }
  }

  const items = st.map((s) => ({ id: s.key, name: s.name, color: s.color }));
  const subItems = items.filter((_, i) => st[i].subtask);
  const linked = new Set(wf.boards.map((b) => b.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={async () => (!dirty || (await confirmDialog({ title: "Buang perubahan yang belum disimpan?", danger: true, confirmLabel: "Buang" }))) && onBack()} className="rounded px-1.5 py-1 text-slate-500 hover:bg-slate-100" aria-label="Kembali"><Icon name="arrow-left" /></button>
        <input disabled={ro} className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold disabled:border-transparent disabled:bg-transparent" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="scroll-thin max-h-[52vh] space-y-5 overflow-y-auto pr-1">
        {/* statuses: order, name, color, done flag */}
        <section>
          <div className="mb-1.5 text-sm font-semibold">1. Status</div>
          <div className="divide-y rounded-md border">
            {st.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 p-1.5">
                <input type="color" disabled={ro} value={s.color ?? "#94a3b8"} onChange={(e) => upd(s.key, { color: e.target.value })} className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-default" title="Warna" />
                <input disabled={ro} className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-0.5 text-sm hover:border-slate-200 focus:border-blue-500 disabled:hover:border-transparent" value={s.name} onChange={(e) => upd(s.key, { name: e.target.value })} />
                <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500" title="Kartu di status ini dianggap selesai">
                  <input type="checkbox" disabled={ro} checked={s.is_done} onChange={(e) => upd(s.key, { is_done: e.target.checked })} />Selesai
                </label>
                {!ro && (
                  <div className="flex shrink-0 items-center">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Naik"><Icon name="chevron-up" className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === st.length - 1} className="rounded px-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Turun"><Icon name="chevron-down" className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(s.key)} disabled={st.length === 1} className="rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label={`Hapus ${s.name}`}><Icon name="x" className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!ro && (
            <div className="mt-2 flex gap-2">
              <input className="flex-1 rounded-md border px-2 py-1.5 text-sm" placeholder="Tambah status, mis. UAT" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
              <button onClick={add} className="rounded-md bg-slate-800 px-3 text-sm text-white dark:bg-blue-600">Tambah</button>
            </div>
          )}
        </section>

        {/* card flow */}
        <section>
          <div className="mb-1.5 text-sm font-semibold">2. Alur kartu</div>
          <FlowEditor items={items} next={Object.fromEntries(st.map((s) => [s.key, s.next]))} readOnly={ro} onChange={setFlow("next")} />
        </section>

        {/* subtask statuses and flow */}
        <section className="space-y-3">
          <div className="text-sm font-semibold">3. Subtask</div>
          <div>
            <div className="mb-1.5 text-xs text-slate-500">Status yang dipakai subtask (yang dicoret tidak muncul di subtask):</div>
            <SubtaskStatusPicker items={items} used={new Set(subItems.map((x) => x.id))} readOnly={ro} onToggle={(k, on) => upd(k, { subtask: on })} />
          </div>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2"><input type="radio" disabled={ro} checked={!own} onChange={() => setOwn(false)} />Ikuti alur kartu</label>
            <label className="flex items-center gap-2"><input type="radio" disabled={ro} checked={own} onChange={() => setOwn(true)} />Alur sendiri</label>
          </div>
          {own && <FlowEditor noun="Subtask" items={subItems} next={Object.fromEntries(st.map((s) => [s.key, s.subtask_next]))} readOnly={ro} onChange={setFlow("subtask_next")} />}
        </section>

        {/* boards that follow this workflow */}
        <section>
          <div className="mb-1 text-sm font-semibold">4. Board yang ikut</div>
          <p className="mb-1.5 text-xs text-slate-500">Board yang dicentang memakai status dan alur di atas. Status dan alurnya tidak bisa diubah dari board itu sendiri.</p>
          <div className="divide-y rounded-md border">
            {boards.length === 0 && <div className="p-2.5 text-sm text-slate-400">Belum ada board di tim ini.</div>}
            {boards.map((b) => {
              const other = all.find((w) => w.id !== wf.id && w.boards.some((x) => x.id === b.id));
              return (
                <label key={b.id} className="flex items-center gap-2 p-2 text-sm">
                  <input type="checkbox" disabled={ro} checked={linked.has(b.id)} onChange={(e) => toggleBoard(b, e.target.checked)} />
                  <span className="flex-1 truncate">{b.name}</span>
                  {other && <span className="text-xs text-slate-400">ikut {other.name}</span>}
                </label>
              );
            })}
          </div>
        </section>
      </div>

      {admin && (
        <div className="flex items-center gap-2 border-t pt-3">
          <button onClick={del} className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Hapus</button>
          <button disabled={!dirty || busy} onClick={save} className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Menyimpan…" : wf.boards.length ? `Simpan & terapkan ke ${wf.boards.length} board` : "Simpan"}
          </button>
        </div>
      )}
    </div>
  );
}
