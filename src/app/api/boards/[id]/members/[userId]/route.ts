import { body, HttpError, requireAdmin, requireMember, route } from "@/lib/api";
import { db } from "@/lib/db";

type P = { id: string; userId: string };

function targetRole(boardId: string, userId: string) {
  const r = db.prepare("select role from board_members where board_id = ? and user_id = ?").get(boardId, userId) as { role: string } | undefined;
  if (!r) throw new HttpError(404, "Member tidak ditemukan");
  return r.role;
}

export const PATCH = route<P>(async ({ req, user, params }) => {
  requireAdmin(params.id, user.id);
  const { role } = await body<{ role?: string }>(req);
  if (role !== "admin" && role !== "member") throw new HttpError(400, "Role tidak valid");
  if (targetRole(params.id, params.userId) === "owner") throw new HttpError(400, "Role owner tidak bisa diubah");
  db.prepare("update board_members set role = ? where board_id = ? and user_id = ?").run(role, params.id, params.userId);
});

export const DELETE = route<P>(({ user, params }) => {
  // members can leave on their own, admins can remove others
  if (params.userId === user.id) requireMember(params.id, user.id);
  else requireAdmin(params.id, user.id);
  if (targetRole(params.id, params.userId) === "owner") throw new HttpError(400, "Owner tidak bisa dikeluarkan");
  db.transaction(() => {
    db.prepare("delete from board_members where board_id = ? and user_id = ?").run(params.id, params.userId);
    db.prepare("delete from card_assignees where user_id = ? and card_id in (select id from cards where board_id = ?)").run(params.userId, params.id);
  })();
});
