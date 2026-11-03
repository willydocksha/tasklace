import { body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeam, requireTeamAdmin } from "@/lib/teams";

type P = { id: string };

// team details: members and boards
export const GET = route<P>(async ({ user, params }) => {
  const role = await requireTeam(params.id, user.id);
  const [[team], members, boards] = await Promise.all([
    sql`select id, name, invite_code, owner_id from teams where id = ${params.id}`,
    sql`select u.id, u.name, u.email, u.color, u.avatar_url as avatar, m.role from team_members m join users u on u.id = m.user_id
      where m.team_id = ${params.id} order by m.role = 'owner' desc, u.name`,
    sql`select b.id, b.name, b.color from team_boards tb join boards b on b.id = tb.board_id where tb.team_id = ${params.id} order by b.name`,
  ]);
  // only admins see the invite code
  return { team: { ...team, invite_code: role === "member" ? null : team.invite_code }, members, boards, role };
});

export const PATCH = route<P>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const { name } = await body<{ name?: string }>(req);
  if (name?.trim()) await sql`update teams set name = ${name.trim().slice(0, 80)} where id = ${params.id}`;
});

// deleting a team keeps its boards; only the link to them goes away
export const DELETE = route<P>(async ({ user, params }) => {
  if ((await requireTeamAdmin(params.id, user.id)) !== "owner") throw new HttpError(403, "Hanya owner yang bisa menghapus tim");
  await sql`delete from teams where id = ${params.id}`;
});
