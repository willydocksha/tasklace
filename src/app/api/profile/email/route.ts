import { body, HttpError, route } from "@/lib/api";
import { checkPassword } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mailMode } from "@/lib/mail";
import { originOf, sendEmailChange } from "@/lib/verify";

// start an email change: confirm the password, then mail a link to the new address
export const POST = route(async ({ req, user }) => {
  const b = await body<{ email?: string; password?: string }>(req);
  const email = (b.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Email tidak valid");
  if (email === user.email) throw new HttpError(400, "Itu sudah email kamu sekarang");
  const [taken] = await sql`select 1 from users where email = ${email}`;
  if (taken) throw new HttpError(409, "Email sudah dipakai akun lain");

  // accounts with a password must confirm it
  const [{ password_hash }] = await sql<{ password_hash: string | null }[]>`select password_hash from users where id = ${user.id}`;
  if (password_hash && !(await checkPassword(b.password ?? "", password_hash))) throw new HttpError(401, "Password salah");

  // without an email service the change applies right away
  if (mailMode === "off") {
    await sql`update users set email = ${email} where id = ${user.id}`;
    return { changed: true, email };
  }
  await sendEmailChange(user, email, originOf(req));
  return { sent: true, email };
});
