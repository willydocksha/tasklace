import { body, boardOf, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";

type P = { id: string };

const TEXT_FIELDS = ["title", "description", "color", "start_date", "due_date"] as const;
const ENUMS = { type: ["epic", "story", "task", "bug"], priority: ["low", "medium", "high", "urgent"] } as const;

type Patch = Partial<Record<(typeof TEXT_FIELDS)[number] | "type" | "priority" | "parent_id" | "list_id", string | null>> & {
  labels?: string[];
  assignees?: string[];
};

export const PATCH = route<P>(async ({ req, user, params }) => {
  const boardId = await boardOf("cards", params.id, user.id);
  const b = await body<Patch>(req);
  await sql.begin(async (tx) => {
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
    if (b.list_id) {
      const [list] = await tx`select 1 from lists where id = ${b.list_id} and board_id = ${boardId}`;
      if (list) {
        const [{ n }] = await tx<{ n: number }[]>`select coalesce(max(position), -1) + 1 as n from cards where list_id = ${b.list_id}`;
        await tx`update cards set list_id = ${b.list_id}, position = ${n} where id = ${params.id}`;
      }
    }
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
          select ${params.id}, user_id from board_members where user_id in ${tx(b.assignees)} and board_id = ${boardId}`;
    }
  });
});

export const DELETE = route<P>(async ({ user, params }) => {
  await boardOf("cards", params.id, user.id);
  await sql`delete from cards where id = ${params.id}`;
});
