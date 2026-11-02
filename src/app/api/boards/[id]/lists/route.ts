import { body, HttpError, requireMember, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireMember(params.id, user.id);
  const { name } = await body<{ name?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama list wajib diisi");
  // append the new list at the end
  const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(position), -1) + 1 as n from lists where board_id = ${params.id}`;
  const id = newId();
  await sql`insert into lists (id, board_id, name, position) values (${id}, ${params.id}, ${name.trim()}, ${n})`;
  return { id };
});
