import { requireAdmin, route } from "@/lib/api";
import { db } from "@/lib/db";

// rotate the invite link so old links stop working
export const POST = route<{ id: string }>(({ user, params }) => {
  requireAdmin(params.id, user.id);
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  db.prepare("update boards set invite_code = ? where id = ?").run(code, params.id);
  return { invite_code: code };
});
