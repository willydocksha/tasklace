import { DONE_LOCKED, logActivity } from "@/lib/activity";
import { boardOf, HttpError, requireCardEdit, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";
import { storeImage } from "@/lib/storage";

type P = { id: string };

const TYPES = ["image/jpeg", "image/webp"];
const MAX = 1536 * 1024; // browser compresses to ~500 KB, this is the hard cap
const MAX_THUMB = 128 * 1024;
const MAX_PER_CARD = 30;

// attachment list (metadata only; images are served by /api/attachments/[id])
export const GET = route<P>(async ({ user, params }) => {
  await boardOf("cards", params.id, user.id);
  return sql`
    select a.id, a.name, a.width, a.height, a.size, a.created_at, a.user_id, u.name as user_name
    from card_attachments a left join users u on u.id = a.user_id
    where a.card_id = ${params.id} order by a.created_at`;
});

// upload one image: multipart with file, thumb, name, width, height
export const POST = route<P>(async ({ req, user, params }) => {
  await requireCardEdit(params.id, user.id);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Body tidak valid");
  });
  const file = form.get("file");
  const thumb = form.get("thumb");
  if (!(file instanceof Blob) || !(thumb instanceof Blob)) throw new HttpError(400, "File gambar tidak ada");
  if (!TYPES.includes(file.type) || !TYPES.includes(thumb.type)) throw new HttpError(400, "Format gambar tidak didukung");
  if (!file.size || file.size > MAX) throw new HttpError(400, "Ukuran gambar maksimal 1,5 MB");
  if (!thumb.size || thumb.size > MAX_THUMB) throw new HttpError(400, "Thumbnail terlalu besar");
  const width = Math.round(Number(form.get("width")));
  const height = Math.round(Number(form.get("height")));
  if (!(width > 0 && height > 0)) throw new HttpError(400, "Ukuran gambar tidak valid");
  const name = String(form.get("name") ?? "").trim().slice(0, 200) || "gambar";

  // done cards are read-only; also cap how many images one card holds
  const [card] = await sql<{ done: boolean; count: number }[]>`
    select l.is_done = 1 as done, (select count(*)::int from card_attachments where card_id = c.id) as count
    from cards c join lists l on l.id = c.list_id where c.id = ${params.id}`;
  if (card.done) throw new HttpError(409, DONE_LOCKED);
  if (card.count >= MAX_PER_CARD) throw new HttpError(400, `Maksimal ${MAX_PER_CARD} lampiran per kartu`);

  const id = newId();
  const data = Buffer.from(await file.arrayBuffer());
  const small = Buffer.from(await thumb.arrayBuffer());
  // files go to storage (bytes stay in the row only when storage is off)
  const path = await storeImage(`attachments/${id}`, file.type, data, small);
  await sql`insert into card_attachments (id, card_id, user_id, name, mime, width, height, size, path, data, thumb, created_at)
    values (${id}, ${params.id}, ${user.id}, ${name}, ${file.type}, ${width}, ${height}, ${data.length}, ${path}, ${path ? null : data}, ${path ? null : small}, ${Date.now()})`;
  await logActivity(sql, user.id, [{ cardId: params.id, kind: "attachment", data: { name } }]);
  return { id };
});
