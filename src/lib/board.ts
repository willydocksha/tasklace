import { logActivity } from "./activity";
import { boardPerms, boardRole } from "./api";
import { newId, sql, type Sql } from "./db";
import type { BoardData, Card } from "./types";

// short issue key from a board name, e.g. "Website Toko Online" -> "WTO"
export function makeKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 4) : (words[0] ?? "").slice(0, 3);
  return /^[A-Z]/.test(key) && key.length >= 2 ? key : "TL";
}

// reserve the next issue number of a board (atomic)
export async function nextNumber(q: Sql, boardId: string) {
  const [{ n }] = await q<{ n: number }[]>`update boards set next_number = next_number + 1 where id = ${boardId} returning next_number - 1 as n`;
  return n;
}

export async function loadBoard(boardId: string, userId: string): Promise<BoardData> {
  // fetch every part of the board in parallel
  const [[board], role, perms, lists, labels, members, rows, cardLabels, cardAssignees, sprints, subtasks] = await Promise.all([
    sql<BoardData["board"][]>`select id, name, description, color, background, icon,
      (select updated_at from board_backgrounds where board_id = boards.id) as photo,
      key, invite_code, owner_id, subtask_own_flow,
      (select json_build_object('id', w.id, 'name', w.name, 'team_id', t.id, 'team_name', t.name)
        from workflows w join teams t on t.id = w.team_id where w.id = boards.workflow_id) as workflow
      from boards where id = ${boardId}`,
    boardRole(boardId, userId),
    boardPerms(boardId, userId),
    sql<BoardData["lists"]>`select id, name, position, is_done, color, next_ids, subtask, subtask_next_ids, workflow_key from lists where board_id = ${boardId} order by position`,
    sql<BoardData["labels"]>`select id, name, color from labels where board_id = ${boardId} order by seq`,
    // direct members and team members, each with their best role
    sql<BoardData["members"]>`
      select u.id, u.name, u.email, u.color, u.avatar_url as avatar,
        (array_agg(a.role order by case a.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end))[1] as role,
        bool_or(a.direct) as direct
      from board_access a join users u on u.id = a.user_id where a.board_id = ${boardId}
      group by u.id order by bool_or(a.role = 'owner') desc, u.name`,
    sql<Omit<Card, "labels" | "assignees" | "subtasks">[]>`
      select c.*, (select count(*) from comments where card_id = c.id) as comment_count,
        (select count(*) from card_attachments where card_id = c.id) as attachment_count
      from cards c where c.board_id = ${boardId} order by c.position`,
    sql<{ card_id: string; label_id: string }[]>`
      select cl.card_id, cl.label_id from card_labels cl join cards c on c.id = cl.card_id where c.board_id = ${boardId}`,
    sql<{ card_id: string; user_id: string }[]>`
      select ca.card_id, ca.user_id from card_assignees ca join cards c on c.id = ca.card_id where c.board_id = ${boardId}`,
    sql<BoardData["sprints"]>`
      select id, name, goal, start_date, end_date, status, created_at from sprints
      where board_id = ${boardId} order by status = 'completed', created_at`,
    sql<BoardData["cards"][number]["subtasks"]>`
      select s.id, s.card_id, s.title, s.list_id, s.position,
        coalesce((select array_agg(user_id) from card_subtask_assignees where subtask_id = s.id), '{}') as assignees
      from card_subtasks s join cards c on c.id = s.card_id
      where c.board_id = ${boardId} order by s.position, s.created_at`,
  ]);

  // attach labels and assignees without n+1 queries
  const byId = new Map<string, Card>(rows.map((r) => [r.id, { ...r, labels: [], assignees: [], subtasks: [] }]));
  for (const r of cardLabels) byId.get(r.card_id)?.labels.push(r.label_id);
  for (const r of cardAssignees) byId.get(r.card_id)?.assignees.push(r.user_id);
  for (const r of subtasks) byId.get(r.card_id)?.subtasks.push(r);

  return { board, lists: [...lists], cards: [...byId.values()], labels: [...labels], members: [...members], sprints: [...sprints], role: role ?? "viewer", perms };
}

const DEFAULT_LISTS: [string, number][] = [["Backlog", 0], ["To Do", 0], ["In Progress", 0], ["Review", 0], ["Done", 1]];
const DEFAULT_LABELS: [string, string][] = [["Frontend", "#579dff"], ["Backend", "#9f8fef"], ["Design", "#e774bb"], ["Penting", "#f87168"]];

export async function createBoard(name: string, color: string, description: string, ownerId: string, look: { background?: string | null; icon?: string | null } = {}) {
  const id = newId();
  const invite = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  // board, owner membership, default lists and labels in one transaction
  await sql.begin(async (tx) => {
    await tx`insert into boards (id, name, description, color, background, icon, key, invite_code, owner_id, created_at)
      values (${id}, ${name}, ${description}, ${color}, ${look.background ?? null}, ${look.icon ?? null}, ${makeKey(name)}, ${invite}, ${ownerId}, ${Date.now()})`;
    await tx`insert into board_members (board_id, user_id, role) values (${id}, ${ownerId}, 'owner')`;
    await tx`insert into lists ${tx(DEFAULT_LISTS.map(([n, done], i) => ({ id: newId(), board_id: id, name: n, position: i, is_done: done })))}`;
    await tx`insert into labels ${tx(DEFAULT_LABELS.map(([n, c]) => ({ id: newId(), board_id: id, name: n, color: c })))}`;
  });
  return id;
}

// copy a board for a new owner: settings, lists (order, colors, done flag, status flow), labels,
// and optionally sprints, cards, labels/assignees on cards and image attachments
export async function duplicateBoard(srcId: string, ownerId: string, name: string, withCards: boolean) {
  const id = newId();
  const invite = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const now = Date.now();
  await sql.begin(async (tx) => {
    // board row and owner membership
    const [src] = await tx<{ description: string; color: string; background: string | null; icon: string | null; key: string; next_number: number; subtask_own_flow: boolean }[]>`
      select description, color, background, icon, key, next_number, subtask_own_flow from boards where id = ${srcId}`;
    await tx`insert into boards (id, name, description, color, background, icon, key, next_number, subtask_own_flow, invite_code, owner_id, created_at)
      values (${id}, ${name}, ${src.description}, ${src.color}, ${src.background}, ${src.icon}, ${src.key}, ${withCards ? src.next_number : 1}, ${src.subtask_own_flow}, ${invite}, ${ownerId}, ${now})`;
    // the uploaded background photo comes along too
    await tx`insert into board_backgrounds (board_id, mime, data, thumb, updated_at)
      select ${id}, mime, data, thumb, updated_at from board_backgrounds where board_id = ${srcId}`;
    await tx`insert into board_members (board_id, user_id, role) values (${id}, ${ownerId}, 'owner')`;

    // lists with new ids, then the status flow remapped to them
    const lists = await tx<{ id: string; name: string; position: number; is_done: number; color: string | null; next_ids: string[] | null; subtask: boolean; subtask_next_ids: string[] | null }[]>`
      select id, name, position, is_done, color, next_ids, subtask, subtask_next_ids from lists where board_id = ${srcId}`;
    const listMap = new Map(lists.map((l) => [l.id, newId()]));
    const remap = (ids: string[] | null) => (ids ? ids.map((x) => listMap.get(x)).filter((x): x is string => !!x) : null);
    if (lists.length)
      await tx`insert into lists ${tx(lists.map((l) => ({ id: listMap.get(l.id)!, board_id: id, name: l.name, position: l.position, is_done: l.is_done, color: l.color, next_ids: remap(l.next_ids), subtask: l.subtask, subtask_next_ids: remap(l.subtask_next_ids) })))}`;

    // labels, in their original order
    const labels = await tx<{ id: string; name: string; color: string }[]>`select id, name, color from labels where board_id = ${srcId} order by seq`;
    const labelMap = new Map(labels.map((l) => [l.id, newId()]));
    for (const l of labels) await tx`insert into labels (id, board_id, name, color) values (${labelMap.get(l.id)!}, ${id}, ${l.name}, ${l.color})`;
    if (!withCards) return;

    // sprints
    const sprints = await tx<{ id: string; name: string; goal: string; start_date: string | null; end_date: string | null; status: string; created_at: number }[]>`
      select id, name, goal, start_date, end_date, status, created_at from sprints where board_id = ${srcId}`;
    const sprintMap = new Map(sprints.map((s) => [s.id, newId()]));
    if (sprints.length) await tx`insert into sprints ${tx(sprints.map((s) => ({ ...s, id: sprintMap.get(s.id)!, board_id: id })))}`;

    // cards keep their numbers; epic links are set after every card exists
    const cards = await tx<{ id: string; list_id: string; parent_id: string | null; sprint_id: string | null; type: string; title: string; description: string; color: string | null; priority: string; start_date: string | null; due_date: string | null; position: number; number: number | null; points: number | null }[]>`
      select id, list_id, parent_id, sprint_id, type, title, description, color, priority, start_date, due_date, position, number, points from cards where board_id = ${srcId}`;
    if (!cards.length) return;
    const cardMap = new Map(cards.map((c) => [c.id, newId()]));

    // attachments get new ids; descriptions that embed them are rewritten
    const atts = await tx<{ id: string; card_id: string }[]>`
      select a.id, a.card_id from card_attachments a join cards c on c.id = a.card_id where c.board_id = ${srcId}`;
    const attMap = new Map(atts.map((a) => [a.id, newId()]));
    const rewrite = (text: string) => (text.includes("/api/attachments/") ? text.replace(/\/api\/attachments\/([0-9a-f-]{36})/g, (m, a) => (attMap.has(a) ? `/api/attachments/${attMap.get(a)}` : m)) : text);

    await tx`insert into cards ${tx(cards.map((c) => ({
      ...c, id: cardMap.get(c.id)!, board_id: id, list_id: listMap.get(c.list_id)!, parent_id: null,
      sprint_id: c.sprint_id ? (sprintMap.get(c.sprint_id) ?? null) : null, description: rewrite(c.description), created_by: ownerId, created_at: now,
    })))}`;
    for (const c of cards) if (c.parent_id && cardMap.has(c.parent_id)) await tx`update cards set parent_id = ${cardMap.get(c.parent_id)!} where id = ${cardMap.get(c.id)!}`;

    // card labels; assignees only when the new owner was one (others are not members yet)
    const srcIds = cards.map((c) => c.id);
    const cl = await tx<{ card_id: string; label_id: string }[]>`select card_id, label_id from card_labels where card_id in ${tx(srcIds)}`;
    if (cl.length) await tx`insert into card_labels ${tx(cl.map((r) => ({ card_id: cardMap.get(r.card_id)!, label_id: labelMap.get(r.label_id)! })))}`;
    await tx`insert into card_assignees (card_id, user_id)
      select x.new_id, ca.user_id from card_assignees ca
      join unnest(${srcIds}::text[], ${srcIds.map((s) => cardMap.get(s)!)}::text[]) as x(old_id, new_id) on x.old_id = ca.card_id
      where ca.user_id = ${ownerId}`;

    // subtasks, with their status remapped to the new lists
    const subs = await tx<{ id: string; card_id: string; title: string; list_id: string | null; position: number; created_at: number; mine: boolean }[]>`
      select s.id, s.card_id, s.title, s.list_id, s.position, s.created_at,
        exists (select 1 from card_subtask_assignees a where a.subtask_id = s.id and a.user_id = ${ownerId}) as mine
      from card_subtasks s where s.card_id in ${tx(srcIds)}`;
    const subMap = new Map(subs.map((r) => [r.id, newId()]));
    if (subs.length)
      await tx`insert into card_subtasks ${tx(subs.map(({ mine: _, ...r }) => ({ ...r, id: subMap.get(r.id)!, card_id: cardMap.get(r.card_id)!, list_id: r.list_id ? (listMap.get(r.list_id) ?? null) : null })))}`;
    // subtask assignees: only the new owner is a member of the copy
    const mine = subs.filter((r) => r.mine);
    if (mine.length) await tx`insert into card_subtask_assignees ${tx(mine.map((r) => ({ subtask_id: subMap.get(r.id)!, user_id: ownerId })))}`;

    // copy image bytes in sql, one row per attachment
    for (const a of atts)
      await tx`insert into card_attachments (id, card_id, user_id, name, mime, width, height, size, data, thumb, created_at)
        select ${attMap.get(a.id)!}, ${cardMap.get(a.card_id)!}, ${ownerId}, name, mime, width, height, size, data, thumb, created_at from card_attachments where id = ${a.id}`;

    // each copied card starts its history in its current list
    const listName = new Map(lists.map((l) => [l.id, l.name]));
    await logActivity(tx, ownerId, cards.map((c) => ({ cardId: cardMap.get(c.id)!, kind: "created", data: { to: listMap.get(c.list_id), toName: listName.get(c.list_id) } })));
  });
  return id;
}
