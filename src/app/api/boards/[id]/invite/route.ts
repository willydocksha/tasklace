import { requireAdmin, route } from "@/lib/api";
import { sql } from "@/lib/db";

// rotate the invite link so old links stop working
export const POST = route<{ id: string }>(async ({ user, params }) => {
  await requireAdmin(params.id, user.id);
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await sql`update boards set invite_code = ${code} where id = ${params.id}`;
  return { invite_code: code };
});
