import { body, HttpError, requireMember, route } from "@/lib/api";
import { db, newId } from "@/lib/db";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  requireMember(params.id, user.id);
  const { name, color } = await body<{ name?: string; color?: string }>(req);
  if (!name?.trim() || !color) throw new HttpError(400, "Nama dan warna label wajib diisi");
  const id = newId();
  db.prepare("insert into labels (id, board_id, name, color) values (?, ?, ?, ?)").run(id, params.id, name.trim(), color);
  return { id };
});
