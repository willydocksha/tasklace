import { body, requireMember, route } from "@/lib/api";
import { db } from "@/lib/db";

// persists list order and/or the card order of specific lists after drag & drop
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  requireMember(params.id, user.id);
  const b = await body<{ listIds?: string[]; lists?: { listId: string; cardIds: string[] }[] }>(req);
  const setList = db.prepare("update lists set position = ? where id = ? and board_id = ?");
  const setCard = db.prepare("update cards set list_id = ?, position = ? where id = ? and board_id = ?");
  const owns = db.prepare("select 1 from lists where id = ? and board_id = ?");
  db.transaction(() => {
    b.listIds?.forEach((id, i) => setList.run(i, id, params.id));
    for (const l of b.lists ?? []) {
      if (!owns.get(l.listId, params.id)) continue;
      l.cardIds.forEach((cid, i) => setCard.run(l.listId, i, cid, params.id));
    }
  })();
});
