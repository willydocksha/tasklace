import { createHash, randomBytes } from "node:crypto";
import { newId, sql } from "./db";
import type { User } from "./auth";

const PREFIX = "tlc_";

// sha-256 is enough here: tokens are long random strings, not passwords
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type TokenInfo = { id: string; name: string; prefix: string; created_at: number; last_used_at: number | null };

// make a token; the plain value is returned once and never stored
export async function createToken(userId: string, name: string) {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const id = newId();
  await sql`insert into api_tokens (id, user_id, name, token_hash, prefix, created_at)
    values (${id}, ${userId}, ${name}, ${hash(token)}, ${token.slice(0, 10)}, ${Date.now()})`;
  return { id, token };
}

export const listTokens = (userId: string) =>
  sql<TokenInfo[]>`select id, name, prefix, created_at, last_used_at from api_tokens where user_id = ${userId} order by created_at desc`;

export const revokeToken = (userId: string, id: string) => sql`delete from api_tokens where id = ${id} and user_id = ${userId}`;

// find the user behind a bearer token, or null
export async function userFromToken(token: string): Promise<User | null> {
  if (!token.startsWith(PREFIX)) return null;
  const [row] = await sql<(User & { token_id: string })[]>`
    select u.id, u.name, u.email, u.color, u.username, u.avatar_url as avatar, u.tours_seen as tours, t.id as token_id
    from api_tokens t join users u on u.id = t.user_id where t.token_hash = ${hash(token)}`;
  if (!row) return null;
  // note when it was last used, without waiting for it
  void sql`update api_tokens set last_used_at = ${Date.now()} where id = ${row.token_id}`.catch(() => {});
  return { id: row.id, name: row.name, email: row.email, color: row.color, username: row.username, avatar: row.avatar, tours: row.tours ?? [] };
}
