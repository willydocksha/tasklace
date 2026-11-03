import { body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeam, requireTeamAdmin } from "@/lib/teams";

type P = { id: string; userId: string };

// role of the member being changed, 404 if not in the team
async function targetRole(teamId: string, userId: string) {
  const [r] = await sql<{ role: string }[]>`select role from team_members where team_id = ${teamId} and user_id = ${userId}`;
  if (!r) throw new HttpError(404, "Member tidak ditemukan");
  return r.role;
}

export const PATCH = route<P>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const { role } = await body<{ role?: string }>(req);
  if (role !== "admin" && role !== "member") throw new HttpError(400, "Role tidak valid");
  if ((await targetRole(params.id, params.userId)) === "owner") throw new HttpError(400, "Role owner tidak bisa diubah");
  await sql`update team_members set role = ${role} where team_id = ${params.id} and user_id = ${params.userId}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  // members can leave on their own, admins can remove others
  if (params.userId === user.id) await requireTeam(params.id, user.id);
  else await requireTeamAdmin(params.id, user.id);
  if ((await targetRole(params.id, params.userId)) === "owner") throw new HttpError(400, "Owner tidak bisa dikeluarkan dari tim");
  await sql`delete from team_members where team_id = ${params.id} and user_id = ${params.userId}`;
});
