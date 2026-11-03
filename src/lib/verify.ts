import { createHash } from "node:crypto";
import { sql } from "./db";
import { sendMail } from "./mail";

const HOURS = 24;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// only same-site relative paths are allowed as a redirect target
export const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/boards");

// public base url, e.g. https://rajutin-plum.vercel.app
export const originOf = (req: Request) => process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;

// email a fresh verification link; older links for this user stop working
export async function sendVerification(user: { id: string; name: string; email: string }, origin: string, next: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await sql`delete from email_tokens where user_id = ${user.id} and purpose = 'verify'`;
  await sql`insert into email_tokens (token_hash, user_id, purpose, next, expires_at, created_at)
    values (${sha(token)}, ${user.id}, 'verify', ${safeNext(next)}, ${Date.now() + HOURS * 3600_000}, ${Date.now()})`;
  const link = `${origin}/api/auth/verify?token=${token}`;
  await sendMail(
    user.email,
    "Verifikasi email Rajutin",
    `Halo ${user.name},\n\nKlik link ini untuk mengaktifkan akun Rajutin kamu:\n${link}\n\nLink berlaku ${HOURS} jam. Abaikan email ini kalau kamu tidak mendaftar.`,
    `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#0c66e4;margin:0 0 12px">🧶 Rajutin</h2>
      <p>Halo ${escape(user.name)},</p>
      <p>Klik tombol di bawah untuk mengaktifkan akun Rajutin kamu.</p>
      <p><a href="${link}" style="display:inline-block;background:#0c66e4;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Verifikasi email</a></p>
      <p style="color:#64748b;font-size:13px">Link berlaku ${HOURS} jam. Abaikan email ini kalau kamu tidak mendaftar.</p>
    </div>`,
  );
}

// consume a verification token; returns the user id and where to go next
export async function consumeVerification(token: string) {
  const [row] = await sql<{ user_id: string; next: string | null }[]>`
    delete from email_tokens where token_hash = ${sha(token)} and purpose = 'verify' and expires_at > ${Date.now()}
    returning user_id, next`;
  if (!row) return null;
  await sql`update users set email_verified_at = coalesce(email_verified_at, ${Date.now()}) where id = ${row.user_id}`;
  return { userId: row.user_id, next: safeNext(row.next) };
}

// seconds since the last verification email, to throttle resends
export async function lastSentAgo(userId: string) {
  const [r] = await sql<{ created_at: number }[]>`select created_at from email_tokens where user_id = ${userId} and purpose = 'verify' order by created_at desc limit 1`;
  return r ? (Date.now() - r.created_at) / 1000 : Infinity;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
