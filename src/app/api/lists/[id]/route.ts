import { body, boardOf, requireAdmin, requirePerm, route } from "@/lib/api";
import { sql } from "@/lib/db";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  const boardId = await boardOf("lists", params.id, user.id);
  await requirePerm(boardId, user.id, "structure");
  const b = await body<{ name?: string; is_done?: boolean; color?: string | null; next_ids?: string[] | null }>(req);
  if (b.name?.trim()) await sql`update lists set name = ${b.name.trim()} where id = ${params.id}`;
  if (b.is_done !== undefined) await sql`update lists set is_done = ${b.is_done ? 1 : 0} where id = ${params.id}`;
  // status flow (admins only): null = any list, else other lists of this board
  if (b.next_ids !== undefined) {
    await requireAdmin(boardId, user.id);
    const ids = b.next_ids === null ? null : (await sql<{ id: string }[]>`
      select id from lists where board_id = ${boardId} and id <> ${params.id} and id in ${sql(b.next_ids.length ? b.next_ids : [""])}`).map((r) => r.id);
    await sql`update lists set next_ids = ${ids} where id = ${params.id}`;
  }
  // only accept hex colors (or null to reset)
  if (b.color === null || (typeof b.color === "string" && /^#[0-9a-f]{6}$/i.test(b.color))) await sql`update lists set color = ${b.color} where id = ${params.id}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  const boardId = await boardOf("lists", params.id, user.id);
  await requirePerm(boardId, user.id, "structure");
  await sql.begin(async (tx) => {
    await tx`delete from lists where id = ${params.id}`;
    // drop the deleted list from other lists' status flow
    await tx`update lists set next_ids = array_remove(next_ids, ${params.id}) where board_id = ${boardId} and ${params.id} = any(next_ids)`;
  });
});
