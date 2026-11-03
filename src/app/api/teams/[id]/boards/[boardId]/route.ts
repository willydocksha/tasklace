import { boardRole, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeam } from "@/lib/teams";

// unshare a board from the team (team admin or board admin)
export const DELETE = route<{ id: string; boardId: string }>(async ({ user, params }) => {
  const teamRole = await requireTeam(params.id, user.id);
  const role = await boardRole(params.boardId, user.id);
  if (teamRole === "member" && role !== "owner" && role !== "admin") throw new HttpError(403, "Hanya admin tim atau admin board yang bisa melakukan ini");
  await sql`delete from team_boards where team_id = ${params.id} and board_id = ${params.boardId}`;
});
