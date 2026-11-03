import { body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeamAdmin } from "@/lib/teams";

// add an existing user to the team by email
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const { email } = await body<{ email?: string }>(req);
  const [u] = await sql<{ id: string }[]>`select id from users where email = ${(email ?? "").trim().toLowerCase()}`;
  if (!u) throw new HttpError(404, "User dengan email itu belum terdaftar. Kirim link undangan tim saja.");
  await sql`insert into team_members (team_id, user_id, role) values (${params.id}, ${u.id}, 'member') on conflict do nothing`;
});
