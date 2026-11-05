import { body, HttpError, requireAdmin, route } from "@/lib/api";
import { sql } from "@/lib/db";

// add an existing user to the board by email
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireAdmin(params.id, user.id);
  const { email } = await body<{ email?: string }>(req);
  const [u] = await sql<{ id: string }[]>`select id from users where email = ${(email ?? "").trim().toLowerCase()}`;
  if (!u) throw new HttpError(404, "User dengan email itu belum terdaftar. Kirim link undangan saja.");
  await sql`insert into board_members (board_id, user_id, role) values (${params.id}, ${u.id}, 'viewer') on conflict do nothing`;
});
