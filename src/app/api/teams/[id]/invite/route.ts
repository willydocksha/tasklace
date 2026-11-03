import { route } from "@/lib/api";
import { sql } from "@/lib/db";
import { newInvite, requireTeamAdmin } from "@/lib/teams";

// rotate the team invite link so old links stop working
export const POST = route<{ id: string }>(async ({ user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const code = newInvite();
  await sql`update teams set invite_code = ${code} where id = ${params.id}`;
  return { invite_code: code };
});
