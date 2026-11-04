import { HttpError } from "./api";
import { newId, sql, type Sql } from "./db";

// one status of a team workflow; next / subtask_next hold other statuses' keys (null = any)
export type WorkflowStatus = {
  key: string;
  name: string;
  color: string | null;
  is_done: boolean;
  subtask: boolean;
  next: string[] | null;
  subtask_next: string[] | null;
};
export type Workflow = { id: string; team_id: string; name: string; statuses: WorkflowStatus[]; subtask_own_flow: boolean };

// error for edits a workflow owns
export const WORKFLOW_LOCKED = "Status dan alur board ini diatur oleh Alur Kerja tim. Ubah di Kelola tim → Alur kerja, atau lepas board dari alur kerja dulu.";

// block structure edits on a board that follows a workflow
export async function requireUnlinked(boardId: string) {
  const [b] = await sql<{ workflow_id: string | null }[]>`select workflow_id from boards where id = ${boardId}`;
  if (b?.workflow_id) throw new HttpError(409, WORKFLOW_LOCKED);
}

// clean up statuses from the client: trimmed unique names, valid colors, keys that exist
export function cleanStatuses(input: unknown): WorkflowStatus[] {
  if (!Array.isArray(input)) throw new HttpError(400, "Daftar status tidak valid");
  const seen = new Set<string>();
  const list = input.slice(0, 40).map((raw) => {
    const s = (raw ?? {}) as Partial<WorkflowStatus>;
    const name = String(s.name ?? "").trim().slice(0, 60);
    if (!name) throw new HttpError(400, "Nama status wajib diisi");
    if (seen.has(name.toLowerCase())) throw new HttpError(400, `Status "${name}" muncul dua kali`);
    seen.add(name.toLowerCase());
    return {
      key: typeof s.key === "string" && s.key ? s.key.slice(0, 64) : newId(),
      name,
      color: typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : null,
      is_done: !!s.is_done,
      subtask: s.subtask !== false,
      next: Array.isArray(s.next) ? s.next.map(String) : null,
      subtask_next: Array.isArray(s.subtask_next) ? s.subtask_next.map(String) : null,
    };
  });
  if (!list.length) throw new HttpError(400, "Alur kerja butuh minimal satu status");
  // drop links to keys that are not in the list
  const keys = new Set(list.map((s) => s.key));
  const keep = (ids: string[] | null, self: string) => (ids ? [...new Set(ids)].filter((k) => keys.has(k) && k !== self) : null);
  return list.map((s) => ({ ...s, next: keep(s.next, s.key), subtask_next: keep(s.subtask_next, s.key) }));
}

// statuses copied from a board's current lists (to start a workflow from it)
export async function statusesOfBoard(boardId: string): Promise<{ statuses: WorkflowStatus[]; own: boolean }> {
  const [lists, [b]] = await Promise.all([
    sql<{ id: string; name: string; color: string | null; is_done: number; subtask: boolean; next_ids: string[] | null; subtask_next_ids: string[] | null }[]>`
      select id, name, color, is_done, subtask, next_ids, subtask_next_ids from lists where board_id = ${boardId} order by position`,
    sql<{ subtask_own_flow: boolean }[]>`select subtask_own_flow from boards where id = ${boardId}`,
  ]);
  // list ids become the status keys; duplicate names are skipped
  const seen = new Set<string>();
  const uniq = lists.filter((l) => !seen.has(l.name.toLowerCase()) && seen.add(l.name.toLowerCase()));
  const statuses = uniq.map((l) => ({ key: l.id, name: l.name, color: l.color, is_done: !!l.is_done, subtask: l.subtask, next: l.next_ids, subtask_next: l.subtask_next_ids }));
  return { statuses: cleanStatuses(statuses), own: !!b?.subtask_own_flow };
}

export type SyncResult = { created: number; removed: number; kept: string[] };

// make a board's lists match a workflow: lists are matched by status key, then by name;
// missing ones are created, empty extra lists are deleted, extra lists with cards stay at the end
export async function applyWorkflow(tx: Sql, boardId: string, wf: Workflow): Promise<SyncResult> {
  const lists = await tx<{ id: string; name: string; workflow_key: string | null; cards: number; subs: number }[]>`
    select l.id, l.name, l.workflow_key,
      (select count(*)::int from cards where list_id = l.id) as cards,
      (select count(*)::int from card_subtasks where list_id = l.id) as subs
    from lists l where l.board_id = ${boardId} order by l.position`;

  // pair each status with a list: same key first, then same name
  const free = new Map(lists.map((l) => [l.id, l]));
  const listOf = new Map<string, string>();
  for (const s of wf.statuses) {
    const hit = lists.find((l) => free.has(l.id) && l.workflow_key === s.key);
    if (!hit) continue;
    listOf.set(s.key, hit.id);
    free.delete(hit.id);
  }
  for (const s of wf.statuses) {
    if (listOf.has(s.key)) continue;
    const hit = [...free.values()].find((l) => l.name.trim().toLowerCase() === s.name.toLowerCase());
    if (!hit) continue;
    listOf.set(s.key, hit.id);
    free.delete(hit.id);
  }

  // create lists for statuses the board does not have yet
  let created = 0;
  for (const s of wf.statuses) {
    if (listOf.has(s.key)) continue;
    const id = newId();
    await tx`insert into lists (id, board_id, name, position) values (${id}, ${boardId}, ${s.name}, 0)`;
    listOf.set(s.key, id);
    created++;
  }

  // extra lists: delete the empty ones, keep (unlinked) the ones still holding cards or subtasks
  const extras = [...free.values()];
  const kept = extras.filter((l) => l.cards || l.subs);
  const empty = extras.filter((l) => !l.cards && !l.subs).map((l) => l.id);
  if (empty.length) await tx`delete from lists where id in ${tx(empty)}`;

  // with leftover lists around, "any" in the workflow means any workflow status
  const all = wf.statuses.map((s) => listOf.get(s.key)!);
  const ids = (keys: string[] | null, self: string) =>
    keys ? keys.map((k) => listOf.get(k)!).filter(Boolean) : kept.length ? all.filter((x) => x !== self) : null;

  // write every status: name, look, done flag, order and both flows
  for (const [i, s] of wf.statuses.entries()) {
    const id = listOf.get(s.key)!;
    await tx`update lists set name = ${s.name}, color = ${s.color}, is_done = ${s.is_done ? 1 : 0}, position = ${i},
      subtask = ${s.subtask}, next_ids = ${ids(s.next, id)}, subtask_next_ids = ${ids(s.subtask_next, id)}, workflow_key = ${s.key}
      where id = ${id}`;
  }
  // leftover lists sit after the workflow and may only move into it
  for (const [i, l] of kept.entries())
    await tx`update lists set position = ${wf.statuses.length + i}, workflow_key = null, next_ids = ${all}, subtask_next_ids = ${all} where id = ${l.id}`;

  await tx`update boards set workflow_id = ${wf.id}, subtask_own_flow = ${wf.subtask_own_flow} where id = ${boardId}`;
  return { created, removed: empty.length, kept: kept.map((l) => l.name) };
}

// load a workflow row
export async function getWorkflow(q: Sql, id: string) {
  const [w] = await q<Workflow[]>`select id, team_id, name, statuses, subtask_own_flow from workflows where id = ${id}`;
  if (!w) throw new HttpError(404, "Alur kerja tidak ditemukan");
  return w;
}

// re-apply a workflow to every board that follows it
export async function syncWorkflow(tx: Sql, wf: Workflow) {
  const boards = await tx<{ id: string; name: string }[]>`select id, name from boards where workflow_id = ${wf.id}`;
  const out: (SyncResult & { board: string })[] = [];
  for (const b of boards) out.push({ board: b.name, ...(await applyWorkflow(tx, b.id, wf)) });
  return out;
}
