import { body, requireMember, route } from "@/lib/api";
import { requireTeam } from "@/lib/teams";
import { sql } from "@/lib/db";
import { PRESENCE_ONLINE_MS, PRESENCE_WRITE_MS, presenceEnabled } from "@/lib/presence";

type Seen = { id: string; seen: number };

// online ids plus everyone's last seen time (for "terakhir aktif ...")
const answer = (rows: Seen[], since: number) => ({
  enabled: true,
  online: rows.filter((r) => r.seen > since).map((r) => r.id),
  seen: Object.fromEntries(rows.map((r) => [r.id, r.seen])),
});

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
    const rows = await sql<Seen[]>`
      select distinct u.id, u.last_seen_at as seen from board_access a join users u on u.id = a.user_id
      where a.board_id = ${boardId} and u.last_seen_at is not null`;
    return answer(rows, since);
  }

  // online members of a team the caller belongs to
  if (teamId) {
    await requireTeam(teamId, user.id);
    const rows = await sql<Seen[]>`
      select u.id, u.last_seen_at as seen from team_members m join users u on u.id = m.user_id
      where m.team_id = ${teamId} and u.last_seen_at is not null`;
    return answer(rows, since);
  }

  // nothing given: only the heartbeat
  return { enabled: true, online: [], seen: {} };
});
