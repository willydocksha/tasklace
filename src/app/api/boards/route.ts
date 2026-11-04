import { body, HttpError, route } from "@/lib/api";
import { createBoard } from "@/lib/board";
import { sql } from "@/lib/db";
import { canCreateTeamBoard, policyOf } from "@/lib/permissions";
import { BOARD_COLORS, BOARD_ICONS, BOARD_SCENES } from "@/lib/theme";

// boards the user can open (directly or via teams) with their team ids:
// boards never placed by hand (new ones) first, then the user's own order, then newest
export const GET = route(({ user }) =>
  sql`
    select b.id, b.name, b.description, b.color, b.background, b.icon,
      (select role from board_access where board_id = b.id and user_id = ${user.id}
        order by case role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end limit 1) as role,
      (select count(distinct user_id) from board_access where board_id = b.id) as member_count,
      (select count(*) from cards where board_id = b.id) as card_count,
      coalesce((select array_agg(team_id) from team_boards where board_id = b.id), '{}') as team_ids
    from boards b
    left join board_positions p on p.board_id = b.id and p.user_id = ${user.id}
    where b.id in (select board_id from board_access where user_id = ${user.id})
    order by p.position is not null, p.position, b.created_at desc`,
);

export const POST = route(async ({ req, user }) => {
  const { name, color, description, teamId, background, icon } = await body<{ name?: string; color?: string; description?: string; teamId?: string; background?: string; icon?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama board wajib diisi");
  // a team board needs the team's "create board" right (checked before anything is made)
  if (teamId) {
    const [t] = await sql<{ role: string; permissions: unknown }[]>`
      select m.role, t.permissions from team_members m join teams t on t.id = m.team_id where m.team_id = ${teamId} and m.user_id = ${user.id}`;
    if (!t) throw new HttpError(404, "Tim tidak ditemukan");
    if (!canCreateTeamBoard(t.role, policyOf(t.permissions))) throw new HttpError(403, "Kamu tidak punya izin membuat board di tim ini");
  }
  // only built-in scenes here; an uploaded photo is sent after the board exists
  const look = {
    background: background?.startsWith("p:") && BOARD_SCENES[background.slice(2)] ? background : null,
    icon: icon && (BOARD_ICONS as readonly string[]).includes(icon) ? icon : null,
  };
  const id = await createBoard(name.trim(), color && BOARD_COLORS[color] ? color : "blue", description?.trim() ?? "", user.id, look);
  if (teamId) await sql`insert into team_boards (team_id, board_id) values (${teamId}, ${id}) on conflict do nothing`;
  return { id };
});

// save the user's own board order (ids from top to bottom); only boards they can open are kept
export const PUT = route(async ({ req, user }) => {
  const { ids } = await body<{ ids?: string[] }>(req);
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) throw new HttpError(400, "Urutan tidak valid");
  const list = [...new Set(ids)].slice(0, 1000);
  await sql.begin(async (tx) => {
    await tx`delete from board_positions where user_id = ${user.id}`;
    if (list.length)
      await tx`insert into board_positions (user_id, board_id, position)
        select ${user.id}, x.id, x.n from unnest(${list}::text[]) with ordinality as x(id, n)
        where x.id in (select board_id from board_access where user_id = ${user.id})`;
  });
});
