import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";
import { db } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Ctx<P> = { params: Promise<P> };

// wraps a route handler with auth + json error handling
export function route<P = Record<string, string>>(
  fn: (args: { req: Request; user: User; params: P }) => Promise<unknown> | unknown,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await currentUser();
      if (!user) throw new HttpError(401, "Belum login");
      const result = await fn({ req, user, params: await ctx.params });
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
  };
}

export function requireMember(boardId: string, userId: string) {
  const row = db.prepare("select role from board_members where board_id = ? and user_id = ?").get(boardId, userId) as
    | { role: string }
    | undefined;
  if (!row) throw new HttpError(404, "Board tidak ditemukan");
  return row.role;
}

export function requireAdmin(boardId: string, userId: string) {
  const role = requireMember(boardId, userId);
  if (role === "member") throw new HttpError(403, "Hanya admin board yang bisa melakukan ini");
  return role;
}

// resolve the board an entity belongs to, then check membership
export function boardOf(table: "lists" | "cards" | "labels", id: string, userId: string) {
  const row = db.prepare(`select board_id from ${table} where id = ?`).get(id) as { board_id: string } | undefined;
  if (!row) throw new HttpError(404, "Data tidak ditemukan");
  requireMember(row.board_id, userId);
  return row.board_id;
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Body tidak valid");
  }
}
