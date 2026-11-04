import { body, HttpError, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";
import { canCreateTeamBoard, policyOf } from "@/lib/permissions";
import { newInvite } from "@/lib/teams";

// teams the user is in, with member and board counts and whether they may add boards
export const GET = route(async ({ user }) => {
  const rows = await sql<{ id: string; name: string; avatar: string | null; role: string; permissions: unknown; member_count: number; board_count: number }[]>`
    select t.id, t.name, t.avatar_url as avatar, m.role, t.permissions,
      (select count(*) from team_members where team_id = t.id) as member_count,
      (select count(*) from team_boards where team_id = t.id) as board_count
    from teams t join team_members m on m.team_id = t.id and m.user_id = ${user.id}
    order by t.created_at`;
  return rows.map(({ permissions, ...t }) => ({ ...t, can_create_board: canCreateTeamBoard(t.role, policyOf(permissions)) }));
});

// create a team; the creator becomes its owner
export const POST = route(async ({ req, user }) => {
  const { name } = await body<{ name?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama tim wajib diisi");
  const id = newId();
  await sql.begin(async (tx) => {
    await tx`insert into teams (id, name, invite_code, owner_id, created_at) values (${id}, ${name.trim().slice(0, 80)}, ${newInvite()}, ${user.id}, ${Date.now()})`;
    await tx`insert into team_members (team_id, user_id, role) values (${id}, ${user.id}, 'owner')`;
  });
  return { id };
});
