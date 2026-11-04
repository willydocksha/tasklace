import { boardRole, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { isAdminRole } from "@/lib/permissions";
import { requireTeam } from "@/lib/teams";

// unshare a board from the team (team admin or board admin)
export const DELETE = route<{ id: string; boardId: string }>(async ({ user, params }) => {
  const teamRole = await requireTeam(params.id, user.id);
  const role = await boardRole(params.boardId, user.id);
  if (!isAdminRole(teamRole) && role !== "owner" && role !== "admin") throw new HttpError(403, "Hanya admin tim atau admin board yang bisa melakukan ini");
  await sql.begin(async (tx) => {
    await tx`delete from team_boards where team_id = ${params.id} and board_id = ${params.boardId}`;
    // a board outside the team stops following the team's workflow
    await tx`update boards set workflow_id = null where id = ${params.boardId} and workflow_id in (select id from workflows where team_id = ${params.id})`;
  });
});
