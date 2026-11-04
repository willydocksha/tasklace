import { NextResponse } from "next/server";
import { currentUser, type User } from "./auth";
import { sql } from "./db";
import { canEditCard, isAdminRole, permsFrom, type Perms } from "./permissions";

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

// best role a user has on a board, directly or through a team; null if none
export async function boardRole(boardId: string, userId: string) {
  const [row] = await sql<{ role: string }[]>`
    select role from board_access where board_id = ${boardId} and user_id = ${userId}
    order by case role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end limit 1`;
  return row?.role ?? null;
}

export async function requireMember(boardId: string, userId: string) {
  const role = await boardRole(boardId, userId);
  if (!role) throw new HttpError(404, "Board tidak ditemukan");
  return role;
}

export async function requireAdmin(boardId: string, userId: string) {
  const role = await requireMember(boardId, userId);
  if (!isAdminRole(role)) throw new HttpError(403, "Hanya admin board yang bisa melakukan ini");
  return role;
}

// everything the user may do on a board, merged over direct and team access; 404 if none
export async function boardPerms(boardId: string, userId: string): Promise<Perms> {
  const rows = await sql<{ role: string; permissions: unknown; team_id: string | null }[]>`
    select a.role, t.permissions, a.team_id from board_access a left join teams t on t.id = a.team_id
    where a.board_id = ${boardId} and a.user_id = ${userId}`;
  if (!rows.length) throw new HttpError(404, "Board tidak ditemukan");
  return permsFrom(rows);
}

const DENIED: Record<"createCard" | "structure" | "comment", string> = {
  createCard: "Kamu tidak punya izin membuat kartu di board ini",
  structure: "Kamu tidak punya izin mengatur list, label, atau sprint di board ini",
  comment: "Kamu tidak punya izin berkomentar di board ini",
};

// 403 unless the user has this right on the board
export async function requirePerm(boardId: string, userId: string, key: keyof typeof DENIED) {
  const p = await boardPerms(boardId, userId);
  if (!p[key]) throw new HttpError(403, DENIED[key]);
  return p;
}

// 403 unless the user may edit this card (all cards, or own/assigned ones); returns its board
export async function requireCardEdit(cardId: string, userId: string) {
  const [c] = await sql<{ board_id: string; created_by: string | null; assignees: string[] }[]>`
    select board_id, created_by, coalesce((select array_agg(user_id) from card_assignees where card_id = c.id), '{}') as assignees
    from cards c where id = ${cardId}`;
  if (!c) throw new HttpError(404, "Data tidak ditemukan");
  const p = await boardPerms(c.board_id, userId);
  if (!canEditCard(p, c, userId)) throw new HttpError(403, p.editCard === "own" ? "Kamu hanya bisa mengubah kartu yang kamu buat atau ditugaskan ke kamu" : "Kamu hanya bisa melihat kartu di board ini");
  return c.board_id;
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
