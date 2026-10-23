import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, newId } from "./db";

export type User = { id: string; name: string; email: string; color: string };

const COOKIE = "tb_session";
const SESSION_DAYS = 30;
const AVATAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}

export function checkPassword(pw: string, hash: string) {
  return bcrypt.compareSync(pw, hash);
}

export function createUser(name: string, email: string, password: string): User {
  const user = {
    id: newId(),
    name,
    email: email.toLowerCase(),
    color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  };
  db.prepare("insert into users (id, name, email, password_hash, color, created_at) values (?, ?, ?, ?, ?, ?)")
    .run(user.id, user.name, user.email, hashPassword(password), user.color, Date.now());
  return user;
}

export async function startSession(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  db.prepare("insert into sessions (token, user_id, expires_at) values (?, ?, ?)").run(token, userId, expires);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.prepare("delete from sessions where token = ?").run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `select u.id, u.name, u.email, u.color, s.expires_at from sessions s
       join users u on u.id = s.user_id where s.token = ?`,
    )
    .get(token) as (User & { expires_at: number }) | undefined;
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, name: row.name, email: row.email, color: row.color };
}
