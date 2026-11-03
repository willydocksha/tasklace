import { logActivity } from "@/lib/activity";
import { body, HttpError, requireMember, route } from "@/lib/api";
import { nextNumber } from "@/lib/board";
import { newId, sql } from "@/lib/db";
import { EPIC_COLORS } from "@/lib/theme";

const TYPES = ["epic", "story", "task", "bug"];

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireMember(params.id, user.id);
  const b = await body<{ title?: string; listId?: string; type?: string; parentId?: string | null; sprintId?: string | null }>(req);
  if (!b.title?.trim()) throw new HttpError(400, "Judul kartu wajib diisi");
  // use the given list, or the first list of the board
  const [list] = b.listId
    ? await sql<{ id: string; name: string }[]>`select id, name from lists where id = ${b.listId} and board_id = ${params.id}`
    : await sql<{ id: string; name: string }[]>`select id, name from lists where board_id = ${params.id} order by position limit 1`;
  if (!list) throw new HttpError(400, "List tidak ditemukan");
  const type = TYPES.includes(b.type ?? "") ? b.type! : "task";
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(position), -1) + 1 as n from cards where list_id = ${list.id}`;
  // epics never sit in a sprint; other sprints must be open and on this board
  let sprintId: string | null = null;
  if (b.sprintId && type !== "epic") {
    const [s] = await sql`select 1 from sprints where id = ${b.sprintId} and board_id = ${params.id} and status <> 'completed'`;
    if (s) sprintId = b.sprintId;
  }
  const id = newId();
  const color = type === "epic" ? EPIC_COLORS[Math.floor(Math.random() * EPIC_COLORS.length)] : null;
  const number = await nextNumber(sql, params.id);
  await sql`insert into cards (id, board_id, list_id, parent_id, sprint_id, type, title, color, position, number, created_by, created_at)
    values (${id}, ${params.id}, ${list.id}, ${b.parentId || null}, ${sprintId}, ${type}, ${b.title.trim()}, ${color}, ${n}, ${number}, ${user.id}, ${Date.now()})`;
  // first entry of the status journey
  await logActivity(sql, user.id, [{ cardId: id, kind: "created", data: { to: list.id, toName: list.name } }]);
  return { id };
});
