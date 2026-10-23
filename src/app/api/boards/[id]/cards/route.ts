import { body, HttpError, requireMember, route } from "@/lib/api";
import { db, newId } from "@/lib/db";
import { EPIC_COLORS } from "@/lib/theme";

const TYPES = ["epic", "story", "task", "bug"];

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  requireMember(params.id, user.id);
  const b = await body<{ title?: string; listId?: string; type?: string; parentId?: string | null }>(req);
  if (!b.title?.trim()) throw new HttpError(400, "Judul kartu wajib diisi");
  const list = b.listId
    ? db.prepare("select id from lists where id = ? and board_id = ?").get(b.listId, params.id)
    : db.prepare("select id from lists where board_id = ? order by position limit 1").get(params.id);
  if (!list) throw new HttpError(400, "List tidak ditemukan");
  const listId = (list as { id: string }).id;
  const type = TYPES.includes(b.type ?? "") ? b.type! : "task";
  const { n } = db.prepare("select coalesce(max(position), -1) + 1 as n from cards where list_id = ?").get(listId) as { n: number };
  const id = newId();
  const color = type === "epic" ? EPIC_COLORS[Math.floor(Math.random() * EPIC_COLORS.length)] : null;
  db.prepare(
    `insert into cards (id, board_id, list_id, parent_id, type, title, color, position, created_by, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, params.id, listId, b.parentId || null, type, b.title.trim(), color, n, user.id, Date.now());
  return { id };
});
