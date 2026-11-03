import { body, HttpError, requireAdmin, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeamAdmin } from "@/lib/teams";

// share a board with the team: needs admin rights on both
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const { boardId } = await body<{ boardId?: string }>(req);
  if (!boardId) throw new HttpError(400, "Pilih board");
  await requireAdmin(boardId, user.id);
  await sql`insert into team_boards (team_id, board_id) values (${params.id}, ${boardId}) on conflict do nothing`;
});
