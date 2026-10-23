import { body, boardOf, route } from "@/lib/api";
import { db } from "@/lib/db";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  boardOf("labels", params.id, user.id);
  const b = await body<{ name?: string; color?: string }>(req);
  if (b.name?.trim()) db.prepare("update labels set name = ? where id = ?").run(b.name.trim(), params.id);
  if (b.color) db.prepare("update labels set color = ? where id = ?").run(b.color, params.id);
});

export const DELETE = route<P>(({ user, params }) => {
  boardOf("labels", params.id, user.id);
  db.prepare("delete from labels where id = ?").run(params.id);
});
