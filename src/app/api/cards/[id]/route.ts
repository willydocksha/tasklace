import { body, boardOf, HttpError, route } from "@/lib/api";
import { db } from "@/lib/db";

type P = { id: string };

const TEXT_FIELDS = ["title", "description", "color", "start_date", "due_date"] as const;
const ENUMS = { type: ["epic", "story", "task", "bug"], priority: ["low", "medium", "high", "urgent"] } as const;

type Patch = Partial<Record<(typeof TEXT_FIELDS)[number] | "type" | "priority" | "parent_id" | "list_id", string | null>> & {
  labels?: string[];
  assignees?: string[];
};

export const PATCH = route<P>(async ({ req, user, params }) => {
  const boardId = boardOf("cards", params.id, user.id);
  const b = await body<Patch>(req);
  db.transaction(() => {
    for (const f of TEXT_FIELDS) {
      if (b[f] === undefined) continue;
      if (f === "title" && !b.title?.trim()) throw new HttpError(400, "Judul tidak boleh kosong");
      db.prepare(`update cards set ${f} = ? where id = ?`).run(b[f] || (f === "description" ? "" : null), params.id);
    }
    for (const [f, allowed] of Object.entries(ENUMS)) {
      const v = b[f as keyof typeof ENUMS];
      if (v && (allowed as readonly string[]).includes(v)) db.prepare(`update cards set ${f} = ? where id = ?`).run(v, params.id);
    }
    if (b.parent_id !== undefined) {
      if (b.parent_id && (b.parent_id === params.id || !db.prepare("select 1 from cards where id = ? and board_id = ? and type = 'epic'").get(b.parent_id, boardId)))
        throw new HttpError(400, "Epic tidak valid");
      db.prepare("update cards set parent_id = ? where id = ?").run(b.parent_id || null, params.id);
    }
    if (b.list_id && db.prepare("select 1 from lists where id = ? and board_id = ?").get(b.list_id, boardId)) {
      const { n } = db.prepare("select coalesce(max(position), -1) + 1 as n from cards where list_id = ?").get(b.list_id) as { n: number };
      db.prepare("update cards set list_id = ?, position = ? where id = ?").run(b.list_id, n, params.id);
    }
    if (b.labels) {
      db.prepare("delete from card_labels where card_id = ?").run(params.id);
      const ins = db.prepare("insert into card_labels (card_id, label_id) select ?, id from labels where id = ? and board_id = ?");
      for (const l of b.labels) ins.run(params.id, l, boardId);
    }
    if (b.assignees) {
      db.prepare("delete from card_assignees where card_id = ?").run(params.id);
      const ins = db.prepare("insert into card_assignees (card_id, user_id) select ?, user_id from board_members where user_id = ? and board_id = ?");
      for (const u of b.assignees) ins.run(params.id, u, boardId);
    }
  })();
});

export const DELETE = route<P>(({ user, params }) => {
  boardOf("cards", params.id, user.id);
  db.prepare("delete from cards where id = ?").run(params.id);
});
