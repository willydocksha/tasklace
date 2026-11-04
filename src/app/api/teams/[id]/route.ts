import { body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { purgeLater } from "@/lib/storage";
import { isAdminRole, policyOf } from "@/lib/permissions";
import { requireTeam, requireTeamAdmin } from "@/lib/teams";

type P = { id: string };

// team details: members and boards
export const GET = route<P>(async ({ user, params }) => {
  const role = await requireTeam(params.id, user.id);
  const [[team], members, boards] = await Promise.all([
    sql`select id, name, avatar_url as avatar, invite_code, owner_id, permissions from teams where id = ${params.id}`,
    sql`select u.id, u.name, u.email, u.color, u.avatar_url as avatar, m.role from team_members m join users u on u.id = m.user_id
      where m.team_id = ${params.id} order by m.role = 'owner' desc, u.name`,
    sql`select b.id, b.name, b.color, b.background, b.icon from team_boards tb join boards b on b.id = tb.board_id where tb.team_id = ${params.id} order by b.name`,
  ]);
  // only admins see the invite code
  const { permissions, ...rest } = team;
  return { team: { ...rest, invite_code: !isAdminRole(role) ? null : team.invite_code }, policy: policyOf(permissions), members, boards, role };
});

export const PATCH = route<P>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const { name, policy } = await body<{ name?: string; policy?: unknown }>(req);
  if (name?.trim()) await sql`update teams set name = ${name.trim().slice(0, 80)} where id = ${params.id}`;
  // permission policy: merged over the current one, unknown values dropped
  if (policy && typeof policy === "object") {
    const [cur] = await sql<{ permissions: unknown }[]>`select permissions from teams where id = ${params.id}`;
    const next = policyOf({ ...policyOf(cur?.permissions), ...policy });
    await sql`update teams set permissions = ${sql.json(next)} where id = ${params.id}`;
  }
});

// deleting a team keeps its boards; only the link to them goes away
export const DELETE = route<P>(async ({ user, params }) => {
  if ((await requireTeamAdmin(params.id, user.id)) !== "owner") throw new HttpError(403, "Hanya owner yang bisa menghapus tim");
  await sql`delete from teams where id = ${params.id}`;
  // the team photo is queued by trigger; remove it
  purgeLater();
});
