import { body, HttpError, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";
import { requireTeam, requireTeamAdmin } from "@/lib/teams";
import { cleanStatuses, statusesOfBoard, type WorkflowStatus } from "@/lib/workflow";

type P = { id: string };

// starting statuses for a blank workflow (matches the default board lists)
const DEFAULT: [string, boolean][] = [["Backlog", false], ["To Do", false], ["In Progress", false], ["Review", false], ["Done", true]];

// the team's workflows, each with the boards that follow it
export const GET = route<P>(async ({ user, params }) => {
  await requireTeam(params.id, user.id);
  return sql`
    select w.id, w.name, w.statuses, w.subtask_own_flow, w.updated_at,
      coalesce((select json_agg(json_build_object('id', b.id, 'name', b.name) order by b.name) from boards b where b.workflow_id = w.id), '[]') as boards
    from workflows w where w.team_id = ${params.id} order by w.created_at`;
});

// new workflow: blank, or copied from one of the team's boards
export const POST = route<P>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const b = await body<{ name?: string; fromBoard?: string }>(req);
  const name = b.name?.trim().slice(0, 80);
  if (!name) throw new HttpError(400, "Nama alur kerja wajib diisi");
  let statuses: WorkflowStatus[];
  let own = false;
  if (b.fromBoard) {
    // only boards shared with this team can be the source
    const [ok] = await sql`select 1 from team_boards where team_id = ${params.id} and board_id = ${b.fromBoard}`;
    if (!ok) throw new HttpError(400, "Board tidak ada di tim ini");
    ({ statuses, own } = await statusesOfBoard(b.fromBoard));
  } else {
    // blank: the default statuses in a straight line
    const keys = DEFAULT.map(() => newId());
    statuses = cleanStatuses(DEFAULT.map(([n, done], i) => ({ key: keys[i], name: n, is_done: done, subtask: true, next: null, subtask_next: null })));
  }
  const id = newId();
  const now = Date.now();
  await sql`insert into workflows (id, team_id, name, statuses, subtask_own_flow, created_at, updated_at)
    values (${id}, ${params.id}, ${name}, ${sql.json(statuses)}, ${own}, ${now}, ${now})`;
  return { id };
});
