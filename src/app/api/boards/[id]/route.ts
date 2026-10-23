import { body, HttpError, requireAdmin, requireMember, route } from "@/lib/api";
import { loadBoard } from "@/lib/board";
import { db } from "@/lib/db";
import { BOARD_COLORS } from "@/lib/theme";

type P = { id: string };

export const GET = route<P>(({ user, params }) => {
  requireMember(params.id, user.id);
  return loadBoard(params.id, user.id);
});

export const PATCH = route<P>(async ({ req, user, params }) => {
  requireAdmin(params.id, user.id);
  const b = await body<{ name?: string; color?: string; description?: string }>(req);
  if (b.name?.trim()) db.prepare("update boards set name = ? where id = ?").run(b.name.trim(), params.id);
  if (b.color && BOARD_COLORS[b.color]) db.prepare("update boards set color = ? where id = ?").run(b.color, params.id);
  if (b.description !== undefined) db.prepare("update boards set description = ? where id = ?").run(b.description, params.id);
});

export const DELETE = route<P>(({ user, params }) => {
  if (requireAdmin(params.id, user.id) !== "owner") throw new HttpError(403, "Hanya owner yang bisa menghapus board");
  db.prepare("delete from boards where id = ?").run(params.id);
});
