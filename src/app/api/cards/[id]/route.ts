import { DONE_LOCKED, logActivity, type ActivityRow } from "@/lib/activity";
import { body, HttpError, requireCardEdit, route } from "@/lib/api";
import { sql, type Sql } from "@/lib/db";
import { canMove, flowError } from "@/lib/flow";
import { purgeLater } from "@/lib/storage";

type P = { id: string };

const TEXT_FIELDS = ["title", "description", "color", "start_date", "due_date"] as const;
const ENUMS = { type: ["epic", "story", "task", "bug"], priority: ["low", "medium", "high", "urgent"] } as const;

type Patch = Partial<Record<(typeof TEXT_FIELDS)[number] | "type" | "priority" | "parent_id" | "list_id" | "sprint_id", string | null>> & {
  points?: number | null;
  labels?: string[];
  assignees?: string[];
};

type Snapshot = {
  title: string; description: string; type: string; priority: string; list_id: string; parent_id: string | null;
  sprint_id: string | null; points: number | null; start_date: string | null; due_date: string | null; done: boolean;
};



// current card values (for the done lock and the activity diff)
async function snapshot(q: Sql, id: string) {
  const [c] = await q<Snapshot[]>`
    select c.title, c.description, c.type, c.priority, c.list_id, c.parent_id, c.sprint_id, c.points, c.start_date, c.due_date,
      l.is_done = 1 as done
    from cards c join lists l on l.id = c.list_id where c.id = ${id}`;
  return c;
}

// names for a set of ids in one table (labels / users / lists / sprints / cards)
async function names(q: Sql, table: "labels" | "users" | "lists" | "sprints" | "cards", ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const col = table === "cards" ? "title" : "name";
  const rows = await q<{ id: string; n: string }[]>`select id, ${q(col)} as n from ${q(table)} where id in ${q(ids)}`;
  return new Map(rows.map((r) => [r.id, r.n]));
}

export const PATCH = route<P>(async ({ req, user, params }) => {
  const boardId = await requireCardEdit(params.id, user.id);
  const b = await body<Patch>(req);
  await sql.begin(async (tx) => {
    const before = await snapshot(tx, params.id);
    // a done card only accepts a status change
    if (before.done && Object.keys(b).some((k) => k !== "list_id")) throw new HttpError(409, DONE_LOCKED);
    const [oldLabels, oldAssignees] = await Promise.all([
      b.labels ? tx<{ id: string }[]>`select label_id as id from card_labels where card_id = ${params.id}` : [],
      b.assignees ? tx<{ id: string }[]>`select user_id as id from card_assignees where card_id = ${params.id}` : [],
    ]);

    // plain text fields; empty clears them
    for (const f of TEXT_FIELDS) {
      if (b[f] === undefined) continue;
      if (f === "title" && !b.title?.trim()) throw new HttpError(400, "Judul tidak boleh kosong");
      await tx`update cards set ${tx(f)} = ${b[f] || (f === "description" ? "" : null)} where id = ${params.id}`;
    }
    // enum fields; unknown values are ignored
    for (const [f, allowed] of Object.entries(ENUMS)) {
      const v = b[f as keyof typeof ENUMS];
      if (v && (allowed as readonly string[]).includes(v)) await tx`update cards set ${tx(f)} = ${v} where id = ${params.id}`;
    }
    // parent must be an epic on the same board
    if (b.parent_id !== undefined) {
      if (b.parent_id) {
        const [epic] = await tx`select 1 from cards where id = ${b.parent_id} and board_id = ${boardId} and type = 'epic'`;
        if (b.parent_id === params.id || !epic) throw new HttpError(400, "Epic tidak valid");
      }
      await tx`update cards set parent_id = ${b.parent_id || null} where id = ${params.id}`;
    }
    // move to the bottom of another list on the same board
    if (b.list_id && b.list_id !== before.list_id) {
      const [list] = await tx<{ name: string }[]>`select name from lists where id = ${b.list_id} and board_id = ${boardId}`;
      // respect the status flow of the current list
      const [cur] = await tx<{ id: string; name: string; next_ids: string[] | null }[]>`select id, name, next_ids from lists where id = ${before.list_id}`;
      if (list && !canMove(cur, b.list_id)) throw new HttpError(409, flowError(cur.name, list.name));
      if (list) {
        const [{ n }] = await tx<{ n: number }[]>`select coalesce(max(position), -1) + 1 as n from cards where list_id = ${b.list_id}`;
        await tx`update cards set list_id = ${b.list_id}, position = ${n} where id = ${params.id}`;
      }
    }
    // story points: whole number 0-999, or empty
    if (b.points !== undefined) {
      const p = b.points === null ? null : Math.round(Number(b.points));
      if (p !== null && !(p >= 0 && p <= 999)) throw new HttpError(400, "Story point harus 0-999");
      await tx`update cards set points = ${p} where id = ${params.id}`;
    }
    // sprint must be open and on this board; epics stay out of sprints
    if (b.sprint_id !== undefined) {
      if (b.sprint_id) {
        const [s] = await tx`select 1 from sprints where id = ${b.sprint_id} and board_id = ${boardId} and status <> 'completed'`;
        if (!s) throw new HttpError(400, "Sprint tidak valid");
      }
      await tx`update cards set sprint_id = ${b.sprint_id || null} where id = ${params.id} and type <> 'epic'`;
    }
    // epics cannot belong to a sprint
    if (b.type === "epic") await tx`update cards set sprint_id = null where id = ${params.id}`;
    // replace labels, keeping only labels of this board
    if (b.labels) {
      await tx`delete from card_labels where card_id = ${params.id}`;
      if (b.labels.length)
        await tx`insert into card_labels (card_id, label_id)
          select ${params.id}, id from labels where id in ${tx(b.labels)} and board_id = ${boardId}`;
    }
    // replace assignees, keeping only members of this board
    if (b.assignees) {
      await tx`delete from card_assignees where card_id = ${params.id}`;
      if (b.assignees.length)
        await tx`insert into card_assignees (card_id, user_id)
          select distinct ${params.id}, user_id from board_access where user_id in ${tx(b.assignees)} and board_id = ${boardId}`;
    }

    await logActivity(tx, user.id, await diff(tx, params.id, before, b, oldLabels.map((r) => r.id), oldAssignees.map((r) => r.id)));
  });
});

// compare before/after and describe each real change
async function diff(tx: Sql, id: string, before: Snapshot, b: Patch, oldLabels: string[], oldAssignees: string[]) {
  const after = await snapshot(tx, id);
  const rows: ActivityRow[] = [];
  const add = (kind: ActivityRow["kind"], data: Record<string, unknown> = {}) => rows.push({ cardId: id, kind, data });

  // status move, with list names
  if (after.list_id !== before.list_id) {
    const n = await names(tx, "lists", [before.list_id, after.list_id]);
    add("status", { from: before.list_id, to: after.list_id, fromName: n.get(before.list_id), toName: n.get(after.list_id) });
  }
  // simple value fields
  if (after.title !== before.title) add("title", { from: before.title, to: after.title });
  if (after.description !== before.description) add("description");
  if (after.type !== before.type) add("type", { from: before.type, to: after.type });
  if (after.priority !== before.priority) add("priority", { from: before.priority, to: after.priority });
  if (after.points !== before.points) add("points", { from: before.points, to: after.points });
  if (after.start_date !== before.start_date) add("start_date", { from: before.start_date, to: after.start_date });
  if (after.due_date !== before.due_date) add("due_date", { from: before.due_date, to: after.due_date });
  // links shown by name
  if (after.parent_id !== before.parent_id) add("epic", { to: after.parent_id ? (await names(tx, "cards", [after.parent_id])).get(after.parent_id) : null });
  if (after.sprint_id !== before.sprint_id) add("sprint", { to: after.sprint_id ? (await names(tx, "sprints", [after.sprint_id])).get(after.sprint_id) : null });

  // set fields: who/what was added or removed
  const setDiff = async (kind: "labels" | "assignees", table: "labels" | "users", old: string[]) => {
    const rows = kind === "labels"
      ? await tx<{ id: string }[]>`select label_id as id from card_labels where card_id = ${id}`
      : await tx<{ id: string }[]>`select user_id as id from card_assignees where card_id = ${id}`;
    const now = rows.map((r) => r.id);
    const added = now.filter((x) => !old.includes(x));
    const removed = old.filter((x) => !now.includes(x));
    if (!added.length && !removed.length) return;
    const n = await names(tx, table, [...added, ...removed]);
    add(kind, { added: added.map((x) => n.get(x)), removed: removed.map((x) => n.get(x)) });
  };
  if (b.labels) await setDiff("labels", "labels", oldLabels);
  if (b.assignees) await setDiff("assignees", "users", oldAssignees);
  return rows;
}

export const DELETE = route<P>(async ({ user, params }) => {
  await requireCardEdit(params.id, user.id);
  // done cards are locked, including deletion
  const [c] = await sql<{ done: boolean }[]>`select l.is_done = 1 as done from cards c join lists l on l.id = c.list_id where c.id = ${params.id}`;
  if (c?.done) throw new HttpError(409, DONE_LOCKED);
  await sql`delete from cards where id = ${params.id}`;
  // attachment files of the card are queued by trigger; remove them
  purgeLater();
});
