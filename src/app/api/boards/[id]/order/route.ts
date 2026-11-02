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
    // reorder cards inside each touched column
    for (const l of b.lists ?? []) {
      const [owns] = await tx`select 1 from lists where id = ${l.listId} and board_id = ${params.id}`;
      if (!owns) continue;
      for (const [i, cid] of l.cardIds.entries())
        await tx`update cards set list_id = ${l.listId}, position = ${i} where id = ${cid} and board_id = ${params.id}`;
    }
  });
});
