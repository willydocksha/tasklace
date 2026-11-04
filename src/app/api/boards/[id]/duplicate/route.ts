import { body, HttpError, requireAdmin, route } from "@/lib/api";
import { duplicateBoard } from "@/lib/board";

// copy this board (rules, lists, labels, optionally cards) into a new board owned by the caller
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireAdmin(params.id, user.id);
  const { name, withCards } = await body<{ name?: string; withCards?: boolean }>(req);
  if (!name?.trim()) throw new HttpError(400, "Nama board wajib diisi");
  return { id: await duplicateBoard(params.id, user.id, name.trim(), !!withCards) };
});
