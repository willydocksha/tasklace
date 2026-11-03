import { logActivity } from "@/lib/activity";
import { body, HttpError, requireMember, route } from "@/lib/api";
import { sql } from "@/lib/db";

type P = { id: string };

// load the sprint and check the user is on its board
async function sprintOf(id: string, userId: string) {
  const [s] = await sql<{ board_id: string; status: string; start_date: string | null; end_date: string | null }[]>`
    select board_id, status, start_date, end_date from sprints where id = ${id}`;
  if (!s) throw new HttpError(404, "Sprint tidak ditemukan");
  await requireMember(s.board_id, userId);
  return s;
}

const isDate = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);

export const PATCH = route<P>(async ({ req, user, params }) => {
  const s = await sprintOf(params.id, user.id);
  const b = await body<{
    name?: string;
    goal?: string;
    start_date?: string | null;
    end_date?: string | null;
    action?: "start" | "complete";
    moveTo?: string | null;
  }>(req);

  await sql.begin(async (tx) => {
    // plain fields
    if (b.name?.trim()) await tx`update sprints set name = ${b.name.trim()} where id = ${params.id}`;
    if (b.goal !== undefined) await tx`update sprints set goal = ${b.goal} where id = ${params.id}`;
    if (b.start_date !== undefined) await tx`update sprints set start_date = ${isDate(b.start_date) ? b.start_date : null} where id = ${params.id}`;
    if (b.end_date !== undefined) await tx`update sprints set end_date = ${isDate(b.end_date) ? b.end_date : null} where id = ${params.id}`;

    // start: one active sprint per board, default length two weeks
    if (b.action === "start") {
      if (s.status !== "planned") throw new HttpError(400, "Sprint ini sudah dimulai");
      const [active] = await tx`select 1 from sprints where board_id = ${s.board_id} and status = 'active'`;
      if (active) throw new HttpError(400, "Selesaikan sprint aktif dulu sebelum memulai sprint baru");
      const start = isDate(b.start_date) ? b.start_date! : (s.start_date ?? new Date().toISOString().slice(0, 10));
      const end = isDate(b.end_date) ? b.end_date! : (s.end_date ?? addDays(start, 14));
      await tx`update sprints set status = 'active', start_date = ${start}, end_date = ${end} where id = ${params.id}`;
    }

    // complete: unfinished issues go to another open sprint or back to the backlog
    if (b.action === "complete") {
      if (s.status !== "active") throw new HttpError(400, "Hanya sprint aktif yang bisa diselesaikan");
      let target: string | null = null;
      if (b.moveTo) {
        const [t] = await tx`select 1 from sprints where id = ${b.moveTo} and board_id = ${s.board_id} and status = 'planned'`;
        if (!t) throw new HttpError(400, "Sprint tujuan tidak valid");
        target = b.moveTo;
      }
      const moved = await tx<{ id: string }[]>`update cards set sprint_id = ${target}
        where sprint_id = ${params.id} and list_id not in (select id from lists where board_id = ${s.board_id} and is_done = 1)
        returning id`;
      // record the carry-over on each card
      const [t] = target ? await tx<{ name: string }[]>`select name from sprints where id = ${target}` : [];
      await logActivity(tx, user.id, moved.map((c) => ({ cardId: c.id, kind: "sprint" as const, data: { to: t?.name ?? null, auto: true } })));
      await tx`update sprints set status = 'completed' where id = ${params.id}`;
    }
  });
});

// deleting a sprint sends its issues back to the backlog
export const DELETE = route<P>(async ({ user, params }) => {
  const s = await sprintOf(params.id, user.id);
  if (s.status === "completed") throw new HttpError(400, "Sprint yang sudah selesai disimpan sebagai riwayat");
  await sql`delete from sprints where id = ${params.id}`;
});
