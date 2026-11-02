import { body, boardOf, route } from "@/lib/api";
import { sql } from "@/lib/db";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  await boardOf("lists", params.id, user.id);
  const b = await body<{ name?: string; is_done?: boolean }>(req);
  if (b.name?.trim()) await sql`update lists set name = ${b.name.trim()} where id = ${params.id}`;
  if (b.is_done !== undefined) await sql`update lists set is_done = ${b.is_done ? 1 : 0} where id = ${params.id}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  await boardOf("lists", params.id, user.id);
  await sql`delete from lists where id = ${params.id}`;
});
