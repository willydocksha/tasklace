import { body, boardOf, route } from "@/lib/api";
import { sql } from "@/lib/db";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  await boardOf("labels", params.id, user.id);
  const b = await body<{ name?: string; color?: string }>(req);
  if (b.name?.trim()) await sql`update labels set name = ${b.name.trim()} where id = ${params.id}`;
  if (b.color) await sql`update labels set color = ${b.color} where id = ${params.id}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  await boardOf("labels", params.id, user.id);
  await sql`delete from labels where id = ${params.id}`;
});
