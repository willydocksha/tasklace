import { logActivity, type ActivityRow } from "@/lib/activity";
import { boardPerms, body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { canMove, flowError } from "@/lib/flow";
import { canEditCard } from "@/lib/permissions";

// persists list order and/or the card order of specific lists after drag & drop
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const perms = await boardPerms(params.id, user.id);
  const b = await body<{ listIds?: string[]; lists?: { listId: string; cardIds: string[] }[] }>(req);
  // column order is board structure; card order needs some edit right
  if (b.listIds?.length && !perms.structure) throw new HttpError(403, "Kamu tidak punya izin mengatur urutan list");
  if (b.lists?.length && perms.editCard === "none") throw new HttpError(403, "Kamu hanya bisa melihat kartu di board ini");
  await sql.begin(async (tx) => {
    // reorder columns
    for (const [i, id] of (b.listIds ?? []).entries())
      await tx`update lists set position = ${i} where id = ${id} and board_id = ${params.id}`;
    // reorder cards inside each touched column; cards arriving from another list are status moves
    const moves: ActivityRow[] = [];
    for (const l of b.lists ?? []) {
      const [owns] = await tx<{ name: string }[]>`select name from lists where id = ${l.listId} and board_id = ${params.id}`;
      if (!owns || !l.cardIds.length) continue;
      const prev = await tx<{ id: string; list_id: string; name: string; next_ids: string[] | null; created_by: string | null; assignees: string[] }[]>`
        select c.id, c.list_id, li.name, li.next_ids, c.created_by,
          coalesce((select array_agg(user_id) from card_assignees where card_id = c.id), '{}') as assignees
        from cards c join lists li on li.id = c.list_id
        where c.id in ${tx(l.cardIds)} and c.board_id = ${params.id} and c.list_id <> ${l.listId}`;
      // every card arriving here must be allowed by its old list's flow
      // moving a card to another status is an edit of that card
      for (const c of prev) if (!canEditCard(perms, c, user.id)) throw new HttpError(403, "Kamu hanya bisa memindahkan kartu yang kamu buat atau ditugaskan ke kamu");
      for (const c of prev) if (!canMove({ id: c.list_id, next_ids: c.next_ids }, l.listId)) throw new HttpError(409, flowError(c.name, owns.name));
      for (const c of prev) moves.push({ cardId: c.id, kind: "status", data: { from: c.list_id, to: l.listId, fromName: c.name, toName: owns.name } });
      for (const [i, cid] of l.cardIds.entries())
        await tx`update cards set list_id = ${l.listId}, position = ${i} where id = ${cid} and board_id = ${params.id}`;
    }
    await logActivity(tx, user.id, moves);
  });
});
