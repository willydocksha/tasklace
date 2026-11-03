import { logActivity, type ActivityRow } from "@/lib/activity";
import { body, requireMember, route } from "@/lib/api";
import { sql } from "@/lib/db";

// persists list order and/or the card order of specific lists after drag & drop
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  await requireMember(params.id, user.id);
  const b = await body<{ listIds?: string[]; lists?: { listId: string; cardIds: string[] }[] }>(req);
  await sql.begin(async (tx) => {
    // reorder columns
    for (const [i, id] of (b.listIds ?? []).entries())
      await tx`update lists set position = ${i} where id = ${id} and board_id = ${params.id}`;
    // reorder cards inside each touched column; cards arriving from another list are status moves
    const moves: ActivityRow[] = [];
    for (const l of b.lists ?? []) {
      const [owns] = await tx<{ name: string }[]>`select name from lists where id = ${l.listId} and board_id = ${params.id}`;
      if (!owns || !l.cardIds.length) continue;
      const prev = await tx<{ id: string; list_id: string; name: string }[]>`
        select c.id, c.list_id, li.name from cards c join lists li on li.id = c.list_id
        where c.id in ${tx(l.cardIds)} and c.board_id = ${params.id} and c.list_id <> ${l.listId}`;
      for (const c of prev) moves.push({ cardId: c.id, kind: "status", data: { from: c.list_id, to: l.listId, fromName: c.name, toName: owns.name } });
      for (const [i, cid] of l.cardIds.entries())
        await tx`update cards set list_id = ${l.listId}, position = ${i} where id = ${cid} and board_id = ${params.id}`;
    }
    await logActivity(tx, user.id, moves);
  });
});
