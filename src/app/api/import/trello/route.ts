import { body, HttpError, route } from "@/lib/api";
import { makeKey } from "@/lib/board";
import { newId, sql } from "@/lib/db";
import { slimTrello, TRELLO_BOARD_COLORS, TRELLO_LABEL_COLORS } from "@/lib/trello";

const DONE_NAMES = /^(done|selesai|complete|completed|closed|finished)$/i;

// trello ids start with a unix timestamp in hex
const idTime = (id: string) => (/^[0-9a-f]{8}/.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : Date.now());
const day = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toISOString().slice(0, 10) : null);

// creates a new board from a trello json export; the importer becomes the owner
export const POST = route(async ({ req, user }) => {
  let t;
  try {
    t = slimTrello(await body(req));
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  if (t.cards.length > 5000 || t.lists.length > 200) throw new HttpError(400, "Board terlalu besar untuk di-import sekaligus");

  // archived lists and cards stay behind
  const lists = t.lists.filter((l) => !l.closed).sort((a, b) => a.pos - b.pos);
  const listIds = new Map(lists.map((l) => [l.id, newId()]));
  const cards = t.cards.filter((c) => !c.closed && listIds.has(c.idList)).sort((a, b) => a.pos - b.pos);
  const labelIds = new Map(t.labels.map((l) => [l.id, newId()]));
  const checklists = new Map(t.checklists.map((c) => [c.id, c]));
  const members = new Map(t.members.map((m) => [m.id, m.fullName || m.username]));
  const cardIds = new Map(cards.map((c) => [c.id, newId()]));

  // checklists, attachments and trello assignees are folded into the description
  const describe = (c: (typeof cards)[number]) => {
    const parts = [c.desc.trim()];
    for (const cl of c.idChecklists.map((id) => checklists.get(id)).filter((x) => !!x).sort((a, b) => a.pos - b.pos)) {
      const items = [...cl.checkItems].sort((a, b) => a.pos - b.pos).map((i) => `${i.state === "complete" ? "☑" : "☐"} ${i.name}`);
      parts.push(`Checklist: ${cl.name}\n${items.join("\n")}`);
    }
    if (c.attachments.length) parts.push(`Lampiran:\n${c.attachments.map((a) => `- ${a.name || "file"}: ${a.url}`).join("\n")}`);
    const names = c.idMembers.map((id) => members.get(id)).filter(Boolean);
    if (names.length) parts.push(`Di Trello ditugaskan ke: ${names.join(", ")}`);
    return parts.filter(Boolean).join("\n\n");
  };

  // a trello member with the importer's name is mapped to the importer
  const me = t.members.find((m) => m.fullName.trim().toLowerCase() === user.name.trim().toLowerCase())?.id;

  const boardId = newId();
  const invite = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const name = t.name.slice(0, 120);
  const color = (t.background && TRELLO_BOARD_COLORS[t.background]) || "blue";
  // keep trello's card numbers when they are unique, otherwise number after them
  let next = Math.max(0, ...cards.map((c) => c.idShort)) + 1;
  const used = new Set<number>();
  const numbers = new Map<string, number>();
  for (const c of cards) {
    const n = c.idShort > 0 && !used.has(c.idShort) ? c.idShort : next++;
    used.add(n);
    numbers.set(c.id, n);
  }

  await sql.begin(async (tx) => {
    await tx`insert into boards (id, name, description, color, key, next_number, invite_code, owner_id, created_at)
      values (${boardId}, ${name}, ${t.desc.slice(0, 2000)}, ${color}, ${makeKey(name)}, ${next}, ${invite}, ${user.id}, ${Date.now()})`;
    await tx`insert into board_members (board_id, user_id, role) values (${boardId}, ${user.id}, 'owner')`;

    if (lists.length)
      await tx`insert into lists ${tx(lists.map((l, i) => ({ id: listIds.get(l.id)!, board_id: boardId, name: l.name.slice(0, 200) || "List", position: i, is_done: DONE_NAMES.test(l.name.trim()) ? 1 : 0 })))}`;

    if (t.labels.length)
      await tx`insert into labels ${tx(t.labels.map((l) => ({ id: labelIds.get(l.id)!, board_id: boardId, name: l.name.slice(0, 80) || (l.color ?? "label"), color: TRELLO_LABEL_COLORS[l.color ?? ""] ?? "#8590a2" })))}`;

    // cards in chunks to stay under postgres' parameter limit
    const pos = new Map<string, number>();
    const rows = cards.map((c) => {
      const p = pos.get(c.idList) ?? 0;
      pos.set(c.idList, p + 1);
      return {
        id: cardIds.get(c.id)!,
        board_id: boardId,
        list_id: listIds.get(c.idList)!,
        type: "task",
        title: c.name.slice(0, 500) || "(tanpa judul)",
        description: describe(c),
        priority: "medium",
        start_date: day(c.start),
        due_date: day(c.due),
        position: p,
        number: numbers.get(c.id)!,
        created_by: user.id,
        created_at: idTime(c.id),
      };
    });
    for (let i = 0; i < rows.length; i += 500) await tx`insert into cards ${tx(rows.slice(i, i + 500))}`;

    const cardLabels = cards.flatMap((c) => c.idLabels.filter((l) => labelIds.has(l)).map((l) => ({ card_id: cardIds.get(c.id)!, label_id: labelIds.get(l)! })));
    for (let i = 0; i < cardLabels.length; i += 1000) await tx`insert into card_labels ${tx(cardLabels.slice(i, i + 1000))} on conflict do nothing`;

    if (me) {
      const mine = cards.filter((c) => c.idMembers.includes(me)).map((c) => ({ card_id: cardIds.get(c.id)!, user_id: user.id }));
      if (mine.length) await tx`insert into card_assignees ${tx(mine)} on conflict do nothing`;
    }

    // comments keep the original author's name in the text
    const comments = t.comments
      .filter((c) => cardIds.has(c.idCard) && c.text.trim())
      .map((c) => ({
        id: newId(),
        card_id: cardIds.get(c.idCard)!,
        user_id: user.id,
        body: `[Trello · ${c.author || "anggota"}]\n${c.text}`,
        created_at: Number.isNaN(Date.parse(c.date)) ? Date.now() : Date.parse(c.date),
      }));
    for (let i = 0; i < comments.length; i += 500) await tx`insert into comments ${tx(comments.slice(i, i + 500))}`;
  });

  return { id: boardId, lists: lists.length, cards: cards.length, labels: t.labels.length, comments: t.comments.filter((c) => cardIds.has(c.idCard)).length };
});
