import { HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 128 * 1024; // browser compresses to ~40 KB, this is the hard cap

// upload a photo (raw image body, already resized by the browser)
export const PUT = route(async ({ req, user }) => {
  const mime = req.headers.get("content-type") ?? "";
  if (!TYPES.includes(mime)) throw new HttpError(400, "Format foto harus JPG, PNG atau WebP");
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > MAX) throw new HttpError(400, "Ukuran foto maksimal 128 KB");
  const now = Date.now();
  await sql`insert into user_avatars (user_id, mime, data, updated_at) values (${user.id}, ${mime}, ${data}, ${now})
    on conflict (user_id) do update set mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`;
  // version in the url so caches pick up the new photo
  const avatar = `/api/avatar/${user.id}?v=${now}`;
  await sql`update users set avatar_url = ${avatar} where id = ${user.id}`;
  return { avatar };
});

// remove the photo, back to initials
export const DELETE = route(async ({ user }) => {
  await sql`delete from user_avatars where user_id = ${user.id}`;
  await sql`update users set avatar_url = null where id = ${user.id}`;
  return { avatar: null };
});
