import { body, requireMember, route } from "@/lib/api";
import { requireTeam } from "@/lib/teams";
import { sql } from "@/lib/db";
import { PRESENCE_ONLINE_MS, PRESENCE_WRITE_MS, presenceEnabled } from "@/lib/presence";

// heartbeat: marks the caller as seen and returns which members of the board or team are online
export const POST = route(async ({ req, user }) => {
  // feature off: the client stops pinging after this answer
  if (!presenceEnabled()) return { enabled: false };

  // bump last_seen_at, throttled so many tabs do not mean many writes
  const now = Date.now();
  await sql`update users set last_seen_at = ${now}
    where id = ${user.id} and (last_seen_at is null or last_seen_at < ${now - PRESENCE_WRITE_MS})`;

  const { boardId, teamId } = await body<{ boardId?: string; teamId?: string }>(req);
  const since = now - PRESENCE_ONLINE_MS;

  // online members of a board the caller can see
  if (boardId) {
    await requireMember(boardId, user.id);
    const rows = await sql<{ id: string }[]>`
      select distinct u.id from board_access a join users u on u.id = a.user_id
      where a.board_id = ${boardId} and u.last_seen_at > ${since}`;
    return { enabled: true, online: rows.map((r) => r.id) };
  }

  // online members of a team the caller belongs to
  if (teamId) {
    await requireTeam(teamId, user.id);
    const rows = await sql<{ id: string }[]>`
      select u.id from team_members m join users u on u.id = m.user_id
      where m.team_id = ${teamId} and u.last_seen_at > ${since}`;
    return { enabled: true, online: rows.map((r) => r.id) };
  }

  // nothing given: only the heartbeat
  return { enabled: true, online: [] };
});
