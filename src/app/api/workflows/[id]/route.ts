import { body, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { requireTeamAdmin } from "@/lib/teams";
import { cleanStatuses, getWorkflow, syncWorkflow } from "@/lib/workflow";

type P = { id: string };

// save the whole workflow, then push it to every board that follows it
export const PUT = route<P>(async ({ req, user, params }) => {
  const wf = await getWorkflow(sql, params.id);
  await requireTeamAdmin(wf.team_id, user.id);
  const b = await body<{ name?: string; statuses?: unknown; subtask_own_flow?: boolean }>(req);
  const name = b.name?.trim().slice(0, 80) || wf.name;
  const statuses = b.statuses === undefined ? wf.statuses : cleanStatuses(b.statuses);
  const own = b.subtask_own_flow ?? wf.subtask_own_flow;
  return sql.begin(async (tx) => {
    await tx`update workflows set name = ${name}, statuses = ${tx.json(statuses)}, subtask_own_flow = ${own}, updated_at = ${Date.now()} where id = ${params.id}`;
    return { boards: await syncWorkflow(tx, { ...wf, name, statuses, subtask_own_flow: own }) };
  });
});

// deleting a workflow keeps the boards' lists as they are now
export const DELETE = route<P>(async ({ user, params }) => {
  const wf = await getWorkflow(sql, params.id);
  await requireTeamAdmin(wf.team_id, user.id);
  await sql`delete from workflows where id = ${params.id}`;
});
