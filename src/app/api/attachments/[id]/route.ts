import { NextResponse } from "next/server";
import { DONE_LOCKED, logActivity } from "@/lib/activity";
import { currentUser } from "@/lib/auth";
import { boardRole, HttpError, requireCardEdit, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { purgeLater, redirectToFile } from "@/lib/storage";

type P = { id: string };

// serve the image (or ?thumb=1, or ?download=1 to save it) to board members; content never changes, so cache for good
export async function GET(req: Request, { params }: { params: Promise<P> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const query = new URL(req.url).searchParams;
  const thumb = query.has("thumb");
  const [row] = await sql<{ board_id: string; mime: string; name: string; path: string | null; data: Buffer | null }[]>`
    select c.board_id, a.mime, a.name, a.path, ${thumb ? sql`a.thumb` : sql`a.data`} as data
    from card_attachments a join cards c on c.id = a.card_id where a.id = ${id}`;
  if (!row || !(await boardRole(row.board_id, user.id))) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  // stored file: send the browser to storage; old rows still carry the bytes
  if (row.path) return redirectToFile(thumb ? `${row.path}.thumb` : row.path, query.has("download") ? row.name : undefined);
  return new Response(new Uint8Array(row.data!), {
    headers: {
      "content-type": row.mime,
      "cache-control": "private, max-age=31536000, immutable",
      "content-disposition": `${query.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    },
  });
}

// remove an attachment (not on done cards)
export const DELETE = route<P>(async ({ user, params }) => {
  const [row] = await sql<{ card_id: string; board_id: string; name: string; done: boolean }[]>`
    select a.card_id, c.board_id, a.name, l.is_done = 1 as done
    from card_attachments a join cards c on c.id = a.card_id join lists l on l.id = c.list_id where a.id = ${params.id}`;
  if (!row || !(await boardRole(row.board_id, user.id))) throw new HttpError(404, "Lampiran tidak ditemukan");
  await requireCardEdit(row.card_id, user.id);
  if (row.done) throw new HttpError(409, DONE_LOCKED);
  await sql`delete from card_attachments where id = ${params.id}`;
  purgeLater();
  await logActivity(sql, user.id, [{ cardId: row.card_id, kind: "attachment", data: { name: row.name, removed: true } }]);
});
