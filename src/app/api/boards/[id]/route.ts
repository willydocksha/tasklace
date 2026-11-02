import { body, HttpError, requireAdmin, requireMember, route } from "@/lib/api";
import { loadBoard } from "@/lib/board";
import { sql } from "@/lib/db";
import { BOARD_COLORS } from "@/lib/theme";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  await requireMember(params.id, user.id);
  return loadBoard(params.id, user.id);
});

export const PATCH = route<P>(async ({ req, user, params }) => {
  await requireAdmin(params.id, user.id);
  const b = await body<{ name?: string; color?: string; description?: string }>(req);
  if (b.name?.trim()) await sql`update boards set name = ${b.name.trim()} where id = ${params.id}`;
  if (b.color && BOARD_COLORS[b.color]) await sql`update boards set color = ${b.color} where id = ${params.id}`;
  if (b.description !== undefined) await sql`update boards set description = ${b.description} where id = ${params.id}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  if ((await requireAdmin(params.id, user.id)) !== "owner") throw new HttpError(403, "Hanya owner yang bisa menghapus board");
  await sql`delete from boards where id = ${params.id}`;
});
