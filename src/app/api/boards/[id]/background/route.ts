import { NextResponse } from "next/server";
import { boardRole, HttpError, requireAdmin, route } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { purgeLater, redirectToFile, storeImage } from "@/lib/storage";

type P = { id: string };

const TYPES = ["image/jpeg", "image/webp"];
const MAX = 768 * 1024; // browser compresses to ~350 KB, this is the hard cap
const MAX_THUMB = 64 * 1024;

// serve the uploaded background (or ?thumb=1) to board members; urls carry ?v=<time>, so cache for good
export async function GET(req: Request, { params }: { params: Promise<P> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });
  const thumb = new URL(req.url).searchParams.has("thumb");
  const [row] = await sql<{ mime: string; path: string | null; data: Buffer | null }[]>`
    select mime, path, ${thumb ? sql`thumb` : sql`data`} as data from board_backgrounds where board_id = ${id}`;
  if (!row || !(await boardRole(id, user.id))) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  // stored file: send the browser to storage; old rows still carry the bytes
  if (row.path) return redirectToFile(thumb ? `${row.path}.thumb` : row.path);
  return new Response(new Uint8Array(row.data!), { headers: { "content-type": row.mime, "cache-control": "private, max-age=31536000, immutable" } });
}

// upload a background photo: multipart with file and thumb, both compressed by the browser
export const PUT = route<P>(async ({ req, user, params }) => {
  await requireAdmin(params.id, user.id);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Body tidak valid");
  });
  const file = form.get("file");
  const thumb = form.get("thumb");
  if (!(file instanceof Blob) || !(thumb instanceof Blob)) throw new HttpError(400, "File gambar tidak ada");
  if (!TYPES.includes(file.type) || !TYPES.includes(thumb.type)) throw new HttpError(400, "Format gambar tidak didukung");
  if (!file.size || file.size > MAX) throw new HttpError(400, "Ukuran gambar maksimal 768 KB");
  if (!thumb.size || thumb.size > MAX_THUMB) throw new HttpError(400, "Thumbnail terlalu besar");

  // one photo per board: replace the old one and point the board at the new version
  const now = Date.now();
  const data = Buffer.from(await file.arrayBuffer());
  const small = Buffer.from(await thumb.arrayBuffer());
  // files go to storage (bytes stay in the row only when storage is off); the old files are trashed by trigger
  const path = await storeImage(`backgrounds/${params.id}-${now}`, file.type, data, small);
  await sql`insert into board_backgrounds (board_id, mime, path, data, thumb, updated_at)
    values (${params.id}, ${file.type}, ${path}, ${path ? null : data}, ${path ? null : small}, ${now})
    on conflict (board_id) do update set mime = excluded.mime, path = excluded.path, data = excluded.data, thumb = excluded.thumb, updated_at = excluded.updated_at`;
  purgeLater();
  const background = `u:${now}`;
  await sql`update boards set background = ${background} where id = ${params.id}`;
  return { background };
});

// drop the uploaded photo (the board falls back to its color if it was using it)
export const DELETE = route<P>(async ({ user, params }) => {
  await requireAdmin(params.id, user.id);
  await sql`delete from board_backgrounds where board_id = ${params.id}`;
  purgeLater();
  await sql`update boards set background = null where id = ${params.id} and background like 'u:%'`;
});
