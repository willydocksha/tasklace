import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";
import { sql } from "./db";

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

export async function requireMember(boardId: string, userId: string) {
  const [row] = await sql<{ role: string }[]>`select role from board_members where board_id = ${boardId} and user_id = ${userId}`;
  if (!row) throw new HttpError(404, "Board tidak ditemukan");
  return row.role;
}

export async function requireAdmin(boardId: string, userId: string) {
  const role = await requireMember(boardId, userId);
  if (role === "member") throw new HttpError(403, "Hanya admin board yang bisa melakukan ini");
  return role;
}

// resolve the board an entity belongs to, then check membership
export async function boardOf(table: "lists" | "cards" | "labels", id: string, userId: string) {
  const [row] = await sql<{ board_id: string }[]>`select board_id from ${sql(table)} where id = ${id}`;
  if (!row) throw new HttpError(404, "Data tidak ditemukan");
  await requireMember(row.board_id, userId);
  return row.board_id;
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Body tidak valid");
  }
}
