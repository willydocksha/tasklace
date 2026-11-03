import { cookies } from "next/headers";
import { body, HttpError, route } from "@/lib/api";
import { checkPassword, hashPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

// change (or, for github/google accounts, set) the password
export const POST = route(async ({ req, user }) => {
  const b = await body<{ current?: string; password?: string }>(req);
  if (!b.password || b.password.length < 6) throw new HttpError(400, "Password baru minimal 6 karakter");
  const [{ password_hash }] = await sql<{ password_hash: string | null }[]>`select password_hash from users where id = ${user.id}`;
  if (password_hash && !(await checkPassword(b.current ?? "", password_hash))) throw new HttpError(401, "Password lama salah");
  await sql`update users set password_hash = ${await hashPassword(b.password)} where id = ${user.id}`;
  // sign out every other device
  const token = (await cookies()).get("tl_session")?.value ?? "";
  await sql`delete from sessions where user_id = ${user.id} and token <> ${token}`;
  return { ok: true };
});
