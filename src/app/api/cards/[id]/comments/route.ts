import { body, boardOf, HttpError, route } from "@/lib/api";
import { db, newId } from "@/lib/db";

type P = { id: string };

export const GET = route<P>(({ user, params }) => {
  boardOf("cards", params.id, user.id);
  return db
    .prepare(
      `select c.id, c.body, c.created_at, c.user_id, u.name, u.color from comments c
       join users u on u.id = c.user_id where c.card_id = ? order by c.created_at`,
    )
    .all(params.id);
});

export const POST = route<P>(async ({ req, user, params }) => {
  boardOf("cards", params.id, user.id);
  const { text } = await body<{ text?: string }>(req);
  if (!text?.trim()) throw new HttpError(400, "Komentar kosong");
  db.prepare("insert into comments (id, card_id, user_id, body, created_at) values (?, ?, ?, ?, ?)").run(newId(), params.id, user.id, text.trim(), Date.now());
});
