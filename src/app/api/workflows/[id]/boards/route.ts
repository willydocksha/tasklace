import { body, HttpError, requireAdmin, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeamAdmin } from "@/lib/teams";
import { applyWorkflow, getWorkflow } from "@/lib/workflow";

// make a team board follow this workflow (its lists are reshaped right away)
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const wf = await getWorkflow(sql, params.id);
  await requireTeamAdmin(wf.team_id, user.id);
  const { boardId } = await body<{ boardId?: string }>(req);
  if (!boardId) throw new HttpError(400, "Pilih board");
  await requireAdmin(boardId, user.id);
  const [ok] = await sql`select 1 from team_boards where team_id = ${wf.team_id} and board_id = ${boardId}`;
  if (!ok) throw new HttpError(400, "Board tidak ada di tim ini");
  return sql.begin((tx) => applyWorkflow(tx, boardId, wf));
});
