import { body, boardOf, HttpError, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  await boardOf("cards", params.id, user.id);
  return sql`
    select c.id, c.body, c.created_at, c.user_id, u.name, u.color from comments c
    join users u on u.id = c.user_id where c.card_id = ${params.id} order by c.created_at`;
});

export const POST = route<P>(async ({ req, user, params }) => {
  await boardOf("cards", params.id, user.id);
  const { text } = await body<{ text?: string }>(req);
  if (!text?.trim()) throw new HttpError(400, "Komentar kosong");
  await sql`insert into comments (id, card_id, user_id, body, created_at)
    values (${newId()}, ${params.id}, ${user.id}, ${text.trim()}, ${Date.now()})`;
});
