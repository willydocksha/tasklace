import { body, boardOf, route } from "@/lib/api";
import { db } from "@/lib/db";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  boardOf("lists", params.id, user.id);
  const b = await body<{ name?: string; is_done?: boolean }>(req);
  if (b.name?.trim()) db.prepare("update lists set name = ? where id = ?").run(b.name.trim(), params.id);
  if (b.is_done !== undefined) db.prepare("update lists set is_done = ? where id = ?").run(b.is_done ? 1 : 0, params.id);
});

export const DELETE = route<P>(({ user, params }) => {
  boardOf("lists", params.id, user.id);
  db.prepare("delete from lists where id = ?").run(params.id);
});
