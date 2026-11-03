import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { newId, sql } from "./db";

export type User = { id: string; name: string; email: string; color: string };

const COOKIE = "rj_session";
const SESSION_DAYS = 30;
const AVATAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

// password is null for github/google accounts; verified marks the email as confirmed
export async function createUser(name: string, email: string, password: string | null, verified = false): Promise<User> {
  const user = {
    id: newId(),
    name,
    email: email.toLowerCase(),
    color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  };
  const now = Date.now();
  await sql`insert into users (id, name, email, password_hash, color, created_at, email_verified_at)
    values (${user.id}, ${user.name}, ${user.email}, ${password ? await hashPassword(password) : null}, ${user.color}, ${now}, ${verified ? now : null})`;
  return user;
}

export async function startSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  await sql`insert into sessions (token, user_id, expires_at) values (${token}, ${userId}, ${expires})`;
  // drop this user's expired sessions so the table stays small
  await sql`delete from sessions where user_id = ${userId} and expires_at < ${Date.now()}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true" || !!process.env.VERCEL,
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where token = ${token}`;
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await sql<(User & { expires_at: number })[]>`
    select u.id, u.name, u.email, u.color, s.expires_at from sessions s
    join users u on u.id = s.user_id where s.token = ${token}`;
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, name: row.name, email: row.email, color: row.color };
}
