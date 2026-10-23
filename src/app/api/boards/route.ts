import { body, HttpError, route } from "@/lib/api";
import { createBoard } from "@/lib/board";
import { db } from "@/lib/db";
import { BOARD_COLORS } from "@/lib/theme";

export const GET = route(({ user }) =>
  db
    .prepare(
      `select b.id, b.name, b.description, b.color, m.role,
        (select count(*) from board_members where board_id = b.id) as member_count,
        (select count(*) from cards where board_id = b.id) as card_count
       from boards b join board_members m on m.board_id = b.id and m.user_id = ? order by b.created_at desc`,
    )
    .all(user.id),
);

export const POST = route(async ({ req, user }) => {
  const { name, color, description } = await body<{ name?: string; color?: string; description?: string }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama board wajib diisi");
  const id = createBoard(name.trim(), color && BOARD_COLORS[color] ? color : "blue", description?.trim() ?? "", user.id);
  return { id };
});
