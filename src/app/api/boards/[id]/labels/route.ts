import { body, HttpError, requireMember, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireMember(params.id, user.id);
  const { name, color } = await body<{ name?: string; color?: string }>(req);
  if (!name?.trim() || !color) throw new HttpError(400, "Nama dan warna label wajib diisi");
  const id = newId();
  await sql`insert into labels (id, board_id, name, color) values (${id}, ${params.id}, ${name.trim()}, ${color})`;
  return { id };
});
