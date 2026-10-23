import { body, HttpError, requireAdmin, route } from "@/lib/api";
import { db } from "@/lib/db";

// add an existing user to the board by email
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  requireAdmin(params.id, user.id);
  const { email } = await body<{ email?: string }>(req);
  const u = db.prepare("select id from users where email = ?").get((email ?? "").trim().toLowerCase()) as { id: string } | undefined;
  if (!u) throw new HttpError(404, "User dengan email itu belum terdaftar. Kirim link undangan saja.");
  db.prepare("insert or ignore into board_members (board_id, user_id, role) values (?, ?, 'member')").run(params.id, u.id);
});
