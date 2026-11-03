import { newId, sql, type Sql } from "./db";
import type { BoardData, Card } from "./types";

// short issue key from a board name, e.g. "Website Toko Online" -> "WTO"
export function makeKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 4) : (words[0] ?? "").slice(0, 3);
  return /^[A-Z]/.test(key) && key.length >= 2 ? key : "RJ";
}

// reserve the next issue number of a board (atomic)
export async function nextNumber(q: Sql, boardId: string) {
  const [{ n }] = await q<{ n: number }[]>`update boards set next_number = next_number + 1 where id = ${boardId} returning next_number - 1 as n`;
  return n;
}

export async function loadBoard(boardId: string, userId: string): Promise<BoardData> {
  // fetch every part of the board in parallel
  const [[board], [member], lists, labels, members, rows, cardLabels, cardAssignees, sprints] = await Promise.all([
    sql<BoardData["board"][]>`select id, name, description, color, key, invite_code, owner_id from boards where id = ${boardId}`,
    sql<{ role: string }[]>`select role from board_members where board_id = ${boardId} and user_id = ${userId}`,
    sql<BoardData["lists"]>`select id, name, position, is_done from lists where board_id = ${boardId} order by position`,
    sql<BoardData["labels"]>`select id, name, color from labels where board_id = ${boardId} order by seq`,
    sql<BoardData["members"]>`
      select u.id, u.name, u.email, u.color, m.role from board_members m
      join users u on u.id = m.user_id where m.board_id = ${boardId} order by m.role = 'owner' desc, u.name`,
    sql<Omit<Card, "labels" | "assignees">[]>`
      select c.*, (select count(*) from comments where card_id = c.id) as comment_count
      from cards c where c.board_id = ${boardId} order by c.position`,
    sql<{ card_id: string; label_id: string }[]>`
      select cl.card_id, cl.label_id from card_labels cl join cards c on c.id = cl.card_id where c.board_id = ${boardId}`,
    sql<{ card_id: string; user_id: string }[]>`
      select ca.card_id, ca.user_id from card_assignees ca join cards c on c.id = ca.card_id where c.board_id = ${boardId}`,
    sql<BoardData["sprints"]>`
      select id, name, goal, start_date, end_date, status, created_at from sprints
      where board_id = ${boardId} order by status = 'completed', created_at`,
  ]);

  // attach labels and assignees without n+1 queries
  const byId = new Map<string, Card>(rows.map((r) => [r.id, { ...r, labels: [], assignees: [] }]));
  for (const r of cardLabels) byId.get(r.card_id)?.labels.push(r.label_id);
  for (const r of cardAssignees) byId.get(r.card_id)?.assignees.push(r.user_id);

  return { board, lists: [...lists], cards: [...byId.values()], labels: [...labels], members: [...members], sprints: [...sprints], role: member.role };
}

const DEFAULT_LISTS: [string, number][] = [["Backlog", 0], ["To Do", 0], ["In Progress", 0], ["Review", 0], ["Done", 1]];
const DEFAULT_LABELS: [string, string][] = [["Frontend", "#579dff"], ["Backend", "#9f8fef"], ["Design", "#e774bb"], ["Penting", "#f87168"]];

export async function createBoard(name: string, color: string, description: string, ownerId: string) {
  const id = newId();
  const invite = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  // board, owner membership, default lists and labels in one transaction
  await sql.begin(async (tx) => {
    await tx`insert into boards (id, name, description, color, key, invite_code, owner_id, created_at)
      values (${id}, ${name}, ${description}, ${color}, ${makeKey(name)}, ${invite}, ${ownerId}, ${Date.now()})`;
    await tx`insert into board_members (board_id, user_id, role) values (${id}, ${ownerId}, 'owner')`;
    await tx`insert into lists ${tx(DEFAULT_LISTS.map(([n, done], i) => ({ id: newId(), board_id: id, name: n, position: i, is_done: done })))}`;
    await tx`insert into labels ${tx(DEFAULT_LABELS.map(([n, c]) => ({ id: newId(), board_id: id, name: n, color: c })))}`;
  });
  return id;
}
