import { boardOf, route } from "@/lib/api";
import { sql } from "@/lib/db";

// card history, oldest first; user may be gone (null name)
export const GET = route<{ id: string }>(async ({ user, params }) => {
  await boardOf("cards", params.id, user.id);
  return sql`
    select a.id, a.kind, a.data, a.created_at, a.user_id, u.name, u.color from card_activity a
    left join users u on u.id = a.user_id where a.card_id = ${params.id} order by a.created_at, a.id`;
});
