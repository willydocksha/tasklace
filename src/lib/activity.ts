import { newId, type Sql } from "./db";

// what changed on a card; data is a small json snapshot (names, not just ids,
// so history still reads right after a list or label is renamed)
export type ActivityKind =
  | "created" | "status" | "title" | "description" | "type" | "priority"
  | "epic" | "sprint" | "points" | "start_date" | "due_date" | "labels" | "assignees";

export type ActivityRow = { cardId: string; kind: ActivityKind; data?: Record<string, unknown> };

// insert one or more activity rows for a user, all with the same timestamp
export async function logActivity(q: Sql, userId: string, rows: ActivityRow[]) {
  if (!rows.length) return;
  const at = Date.now();
  await q`insert into card_activity ${q(
    rows.map((r) => ({ id: newId(), card_id: r.cardId, user_id: userId, kind: r.kind, data: q.json((r.data ?? {}) as never), created_at: at })),
  )}`;
}

// error for edits on a card sitting in a done list
export const DONE_LOCKED = "Kartu sudah Done. Pindahkan statusnya dulu untuk mengedit.";
