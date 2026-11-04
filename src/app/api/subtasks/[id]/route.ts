import { DONE_LOCKED, logActivity } from "@/lib/activity";
import { body, HttpError, requireCardEdit, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { canMove, firstSubtaskList, flowError, subtaskFlow } from "@/lib/flow";

type P = { id: string };
type Row = { card_id: string; board_id: string; title: string; list_id: string | null; done: boolean; own_flow: boolean };

// the subtask with its card's board and done flag, after a membership check
async function load(id: string, userId: string) {
  const [row] = await sql<Row[]>`
    select s.card_id, c.board_id, s.title, s.list_id, l.is_done = 1 as done, b.subtask_own_flow as own_flow
    from card_subtasks s join cards c on c.id = s.card_id join lists l on l.id = c.list_id join boards b on b.id = c.board_id
    where s.id = ${id}`;
  if (!row) throw new HttpError(404, "Subtask tidak ditemukan");
  await requireCardEdit(row.card_id, userId);
  // subtasks of a done card are locked like the card itself
  if (row.done) throw new HttpError(409, DONE_LOCKED);
  return row;
}

// rename and/or change status (following the board's status flow)
export const PATCH = route<P>(async ({ req, user, params }) => {
  const s = await load(params.id, user.id);
  const b = await body<{ title?: string; list_id?: string; assignees?: string[] }>(req);
  // replace the assignee list, keeping only people with access to the board
  if (b.assignees) {
    const before = await sql<{ id: string }[]>`select user_id as id from card_subtask_assignees where subtask_id = ${params.id}`;
    await sql.begin(async (tx) => {
      await tx`delete from card_subtask_assignees where subtask_id = ${params.id}`;
      if (b.assignees!.length)
        await tx`insert into card_subtask_assignees (subtask_id, user_id)
          select distinct ${params.id}, user_id from board_access where board_id = ${s.board_id} and user_id in ${tx(b.assignees!)}`;
    });
    // log who was added / removed, by name
    const now = (await sql<{ id: string }[]>`select user_id as id from card_subtask_assignees where subtask_id = ${params.id}`).map((r) => r.id);
    const old = before.map((r) => r.id);
    const added = now.filter((x) => !old.includes(x));
    const removed = old.filter((x) => !now.includes(x));
    if (added.length || removed.length) {
      const names = new Map((await sql<{ id: string; name: string }[]>`select id, name from users where id in ${sql([...added, ...removed])}`).map((u) => [u.id, u.name]));
      await logActivity(sql, user.id, [{ cardId: s.card_id, kind: "subtask", data: { action: "assignees", title: s.title, added: added.map((x) => names.get(x)), removed: removed.map((x) => names.get(x)) } }]);
    }
  }
  if (b.title !== undefined) {
    if (!b.title.trim()) throw new HttpError(400, "Judul subtask tidak boleh kosong");
    await sql`update card_subtasks set title = ${b.title.trim()} where id = ${params.id}`;
  }
  if (b.list_id) {
    // subtask view of the lists; a missing status counts as the first subtask list
    const lists = subtaskFlow(await sql<{ id: string; name: string; position: number; next_ids: string[] | null; subtask: boolean; subtask_next_ids: string[] | null }[]>`
      select id, name, position, next_ids, subtask, subtask_next_ids from lists where board_id = ${s.board_id} order by position`, s.own_flow);
    const from = lists.find((l) => l.id === s.list_id) ?? firstSubtaskList(lists);
    const to = lists.find((l) => l.id === b.list_id);
    if (!to) throw new HttpError(400, "Status tidak valid");
    if (to.id === from?.id) return;
    if (!canMove(from, to.id)) throw new HttpError(409, flowError(from.name, to.name));
    await sql`update card_subtasks set list_id = ${to.id} where id = ${params.id}`;
    await logActivity(sql, user.id, [{ cardId: s.card_id, kind: "subtask", data: { action: "status", title: b.title?.trim() || s.title, fromName: from?.name, toName: to.name, to: to.id } }]);
  }
});

export const DELETE = route<P>(async ({ user, params }) => {
  const s = await load(params.id, user.id);
  await sql`delete from card_subtasks where id = ${params.id}`;
  await logActivity(sql, user.id, [{ cardId: s.card_id, kind: "subtask", data: { action: "removed", title: s.title } }]);
});
