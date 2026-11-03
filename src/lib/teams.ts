import { HttpError } from "./api";
import { sql } from "./db";

// the user's role in a team, 404 if not a member
export async function requireTeam(teamId: string, userId: string) {
  const [r] = await sql<{ role: string }[]>`select role from team_members where team_id = ${teamId} and user_id = ${userId}`;
  if (!r) throw new HttpError(404, "Tim tidak ditemukan");
  return r.role;
}

export async function requireTeamAdmin(teamId: string, userId: string) {
  const role = await requireTeam(teamId, userId);
  if (role === "member") throw new HttpError(403, "Hanya admin tim yang bisa melakukan ini");
  return role;
}

export const newInvite = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
