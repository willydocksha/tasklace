import { DONE_LOCKED, logActivity } from "@/lib/activity";
import { body, HttpError, requireCardEdit, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";

// add a subtask at the bottom, starting in the board's first subtask list
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const boardId = await requireCardEdit(params.id, user.id);
  const { title } = await body<{ title?: string }>(req);
  if (!title?.trim()) throw new HttpError(400, "Judul subtask wajib diisi");
  const [c] = await sql<{ done: boolean }[]>`select l.is_done = 1 as done from cards c join lists l on l.id = c.list_id where c.id = ${params.id}`;
  if (c?.done) throw new HttpError(409, DONE_LOCKED);
  const [first] = await sql<{ id: string }[]>`select id from lists where board_id = ${boardId} order by not subtask, position limit 1`;
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(position), -1) + 1 as n from card_subtasks where card_id = ${params.id}`;
  const id = newId();
  await sql`insert into card_subtasks (id, card_id, title, list_id, position, created_at)
    values (${id}, ${params.id}, ${title.trim()}, ${first?.id ?? null}, ${n}, ${Date.now()})`;
  await logActivity(sql, user.id, [{ cardId: params.id, kind: "subtask", data: { action: "added", title: title.trim() } }]);
  return { id };
});
