import { HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";
import { purgeLater, redirectToFile, storeImage } from "@/lib/storage";
import { requireTeamAdmin } from "@/lib/teams";

type P = { id: string };

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 128 * 1024; // browser compresses to ~40 KB, this is the hard cap

// serve the team photo; urls carry ?v=<time>, so they can be cached for good
export async function GET(_req: Request, { params }: { params: Promise<P> }) {
  const { id } = await params;
  const [row] = await sql<{ mime: string; path: string | null; data: Buffer | null }[]>`select mime, path, data from team_avatars where team_id = ${id}`;
  if (!row) return new Response("not found", { status: 404 });
  // stored file: send the browser to storage; old rows still carry the bytes
  if (row.path) return redirectToFile(row.path);
  return new Response(new Uint8Array(row.data!), { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable" } });
}

// upload a team photo (raw image body, already cropped by the browser)
export const PUT = route<P>(async ({ req, user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  const mime = req.headers.get("content-type") ?? "";
  if (!TYPES.includes(mime)) throw new HttpError(400, "Format foto harus JPG, PNG atau WebP");
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > MAX) throw new HttpError(400, "Ukuran foto maksimal 128 KB");
  const now = Date.now();
  // the file goes to storage (bytes stay in the row only when storage is off); the old file is trashed by trigger
  const path = await storeImage(`avatars/team/${params.id}-${now}`, mime, data);
  await sql`insert into team_avatars (team_id, mime, path, data, updated_at) values (${params.id}, ${mime}, ${path}, ${path ? null : data}, ${now})
    on conflict (team_id) do update set mime = excluded.mime, path = excluded.path, data = excluded.data, updated_at = excluded.updated_at`;
  purgeLater();
  // version in the url so caches pick up the new photo
  const avatar = `/api/teams/${params.id}/avatar?v=${now}`;
  await sql`update teams set avatar_url = ${avatar} where id = ${params.id}`;
  return { avatar };
});

// remove the photo, back to initials
export const DELETE = route<P>(async ({ user, params }) => {
  await requireTeamAdmin(params.id, user.id);
  await sql`delete from team_avatars where team_id = ${params.id}`;
  purgeLater();
  await sql`update teams set avatar_url = null where id = ${params.id}`;
  return { avatar: null };
});
