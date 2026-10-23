import { db, newId } from "./db";
import type { BoardData, Card } from "./types";

export function loadBoard(boardId: string, userId: string): BoardData {
  const board = db.prepare("select id, name, description, color, invite_code, owner_id from boards where id = ?").get(boardId) as BoardData["board"];
  const role = (db.prepare("select role from board_members where board_id = ? and user_id = ?").get(boardId, userId) as { role: string }).role;
  const lists = db.prepare("select id, name, position, is_done from lists where board_id = ? order by position").all(boardId) as BoardData["lists"];
  const labels = db.prepare("select id, name, color from labels where board_id = ? order by rowid").all(boardId) as BoardData["labels"];
  const members = db
    .prepare(
      `select u.id, u.name, u.email, u.color, m.role from board_members m
       join users u on u.id = m.user_id where m.board_id = ? order by m.role = 'owner' desc, u.name`,
    )
    .all(boardId) as BoardData["members"];
  const rows = db
    .prepare(
      `select c.*, (select count(*) from comments where card_id = c.id) as comment_count
       from cards c where c.board_id = ? order by c.position`,
    )
    .all(boardId) as Omit<Card, "labels" | "assignees">[];

  // attach labels and assignees in two queries instead of n+1
  const byId = new Map<string, Card>(rows.map((r) => [r.id, { ...r, labels: [], assignees: [] }]));
  for (const r of db.prepare("select cl.card_id, cl.label_id from card_labels cl join cards c on c.id = cl.card_id where c.board_id = ?").all(boardId) as { card_id: string; label_id: string }[])
    byId.get(r.card_id)?.labels.push(r.label_id);
  for (const r of db.prepare("select ca.card_id, ca.user_id from card_assignees ca join cards c on c.id = ca.card_id where c.board_id = ?").all(boardId) as { card_id: string; user_id: string }[])
    byId.get(r.card_id)?.assignees.push(r.user_id);

  return { board, lists, cards: [...byId.values()], labels, members, role };
}

const DEFAULT_LISTS: [string, number][] = [["Backlog", 0], ["To Do", 0], ["In Progress", 0], ["Review", 0], ["Done", 1]];
const DEFAULT_LABELS: [string, string][] = [["Frontend", "#579dff"], ["Backend", "#9f8fef"], ["Design", "#e774bb"], ["Penting", "#f87168"]];

export function createBoard(name: string, color: string, description: string, ownerId: string) {
  const id = newId();
  const invite = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  db.transaction(() => {
    db.prepare("insert into boards (id, name, description, color, invite_code, owner_id, created_at) values (?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, description, color, invite, ownerId, Date.now());
    db.prepare("insert into board_members (board_id, user_id, role) values (?, ?, 'owner')").run(id, ownerId);
    DEFAULT_LISTS.forEach(([n, done], i) =>
      db.prepare("insert into lists (id, board_id, name, position, is_done) values (?, ?, ?, ?, ?)").run(newId(), id, n, i, done),
    );
    for (const [n, c] of DEFAULT_LABELS) db.prepare("insert into labels (id, board_id, name, color) values (?, ?, ?, ?)").run(newId(), id, n, c);
  })();
  return id;
}
