import { body, HttpError, requireAdmin, requireMember, route } from "@/lib/api";
import { loadBoard } from "@/lib/board";
import { sql } from "@/lib/db";
import { BOARD_COLORS, BOARD_ICONS, BOARD_SCENES } from "@/lib/theme";
import { requireUnlinked } from "@/lib/workflow";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  await requireMember(params.id, user.id);
  return loadBoard(params.id, user.id);
});

export const PATCH = route<P>(async ({ req, user, params }) => {
  await requireAdmin(params.id, user.id);
  const b = await body<{ name?: string; color?: string; description?: string; key?: string; background?: string | null; icon?: string | null; subtask_own_flow?: boolean; workflow_id?: null }>(req);
  if (b.name?.trim()) await sql`update boards set name = ${b.name.trim()} where id = ${params.id}`;
  // picking a plain color also drops the background image
  if (b.color && BOARD_COLORS[b.color]) await sql`update boards set color = ${b.color}, background = null where id = ${params.id}`;
  // background: null, a built-in scene "p:<name>", or "u" to switch back to the uploaded photo
  if (b.background === null) await sql`update boards set background = null where id = ${params.id}`;
  else if (b.background?.startsWith("p:") && BOARD_SCENES[b.background.slice(2)]) await sql`update boards set background = ${b.background} where id = ${params.id}`;
  else if (b.background === "u")
    await sql`update boards set background = 'u:' || bg.updated_at from board_backgrounds bg where bg.board_id = boards.id and boards.id = ${params.id}`;
  // icon from the fixed set, or null for none
  if (b.icon === null || (b.icon && (BOARD_ICONS as readonly string[]).includes(b.icon))) await sql`update boards set icon = ${b.icon} where id = ${params.id}`;
  // issue key prefix, e.g. TLC
  if (b.key !== undefined) {
    const key = b.key.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) throw new HttpError(400, "Kode issue 2-10 huruf/angka, diawali huruf");
    await sql`update boards set key = ${key} where id = ${params.id}`;
  }
  if (b.description !== undefined) await sql`update boards set description = ${b.description} where id = ${params.id}`;
  // subtasks follow the card flow or their own (not while a team workflow decides it)
  if (b.subtask_own_flow !== undefined) {
    await requireUnlinked(params.id);
    await sql`update boards set subtask_own_flow = ${!!b.subtask_own_flow} where id = ${params.id}`;
  }
  // detach from the team workflow; lists keep their current settings
  if (b.workflow_id === null) await sql`update boards set workflow_id = null where id = ${params.id}`;
});

export const DELETE = route<P>(async ({ user, params }) => {
  if ((await requireAdmin(params.id, user.id)) !== "owner") throw new HttpError(403, "Hanya owner yang bisa menghapus board");
  await sql`delete from boards where id = ${params.id}`;
});
