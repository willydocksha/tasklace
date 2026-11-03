import { body, HttpError, route } from "@/lib/api";
import { createBoard } from "@/lib/board";
import { sql } from "@/lib/db";
import { BOARD_COLORS } from "@/lib/theme";

// boards the user can open (directly or via teams), newest first, with their team ids
export const GET = route(({ user }) =>
  sql`
    select b.id, b.name, b.description, b.color,
      (select role from board_access where board_id = b.id and user_id = ${user.id}
        order by case role when 'owner' then 0 when 'admin' then 1 else 2 end limit 1) as role,
      (select count(distinct user_id) from board_access where board_id = b.id) as member_count,
      (select count(*) from cards where board_id = b.id) as card_count,
      coalesce((select array_agg(team_id) from team_boards where board_id = b.id), '{}') as team_ids
    from boards b
    where b.id in (select board_id from board_access where user_id = ${user.id})
    order by b.created_at desc`,
);

export const POST = route(async ({ req, user }) => {
  const { name, color, description, teamId } = await body<{ name?: string; color?: string; description?: string; teamId?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama board wajib diisi");
  const id = await createBoard(name.trim(), color && BOARD_COLORS[color] ? color : "blue", description?.trim() ?? "", user.id);
  // optionally share it with a team the user can manage
  if (teamId) {
    const [t] = await sql`select 1 from team_members where team_id = ${teamId} and user_id = ${user.id} and role in ('owner', 'admin')`;
    if (t) await sql`insert into team_boards (team_id, board_id) values (${teamId}, ${id}) on conflict do nothing`;
  }
  return { id };
});
