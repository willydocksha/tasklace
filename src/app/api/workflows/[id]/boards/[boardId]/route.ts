import { boardRole, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { isAdminRole } from "@/lib/permissions";
import { requireTeam } from "@/lib/teams";
import { getWorkflow } from "@/lib/workflow";

// stop a board following this workflow (team admin or board admin); its lists stay as they are
export const DELETE = route<{ id: string; boardId: string }>(async ({ user, params }) => {
  const wf = await getWorkflow(sql, params.id);
  const teamRole = await requireTeam(wf.team_id, user.id).catch(() => null);
  const role = await boardRole(params.boardId, user.id);
  if (!(teamRole && isAdminRole(teamRole)) && role !== "owner" && role !== "admin") throw new HttpError(403, "Hanya admin tim atau admin board yang bisa melakukan ini");
  await sql`update boards set workflow_id = null where id = ${params.boardId} and workflow_id = ${params.id}`;
});
