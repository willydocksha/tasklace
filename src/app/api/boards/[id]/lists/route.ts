import { body, HttpError, requireMember, route } from "@/lib/api";
import { db, newId } from "@/lib/db";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  requireMember(params.id, user.id);
  const { name } = await body<{ name?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama list wajib diisi");
  const { n } = db.prepare("select coalesce(max(position), -1) + 1 as n from lists where board_id = ?").get(params.id) as { n: number };
  const id = newId();
  db.prepare("insert into lists (id, board_id, name, position) values (?, ?, ?, ?)").run(id, params.id, name.trim(), n);
  return { id };
});
