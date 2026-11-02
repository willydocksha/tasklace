import { body, HttpError, requireAdmin, requireMember, route } from "@/lib/api";
import { sql } from "@/lib/db";

type P = { id: string; userId: string };

// role of the member being changed, 404 if not on the board
async function targetRole(boardId: string, userId: string) {
  const [r] = await sql<{ role: string }[]>`select role from board_members where board_id = ${boardId} and user_id = ${userId}`;
  if (!r) throw new HttpError(404, "Member tidak ditemukan");
  return r.role;
}

export const PATCH = route<P>(async ({ req, user, params }) => {
  await requireAdmin(params.id, user.id);
  const { role } = await body<{ role?: string }>(req);
  if (role !== "admin" && role !== "member") throw new HttpError(400, "Role tidak valid");
  if ((await targetRole(params.id, params.userId)) === "owner") throw new HttpError(400, "Role owner tidak bisa diubah");
  await sql`update board_members set role = ${role} where board_id = ${params.id} and user_id = ${params.userId}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  // members can leave on their own, admins can remove others
  if (params.userId === user.id) await requireMember(params.id, user.id);
  else await requireAdmin(params.id, user.id);
  if ((await targetRole(params.id, params.userId)) === "owner") throw new HttpError(400, "Owner tidak bisa dikeluarkan");
  // drop membership and their card assignments on this board
  await sql.begin(async (tx) => {
    await tx`delete from board_members where board_id = ${params.id} and user_id = ${params.userId}`;
    await tx`delete from card_assignees where user_id = ${params.userId} and card_id in (select id from cards where board_id = ${params.id})`;
  });
});
