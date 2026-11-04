import { sql } from "@/lib/db";
import { redirectToFile } from "@/lib/storage";

// serve an uploaded photo; urls carry ?v=<time>, so they can be cached for good
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await sql<{ mime: string; path: string | null; data: Buffer | null }[]>`select mime, path, data from user_avatars where user_id = ${id}`;
  if (!row) return new Response("not found", { status: 404 });
  // stored file: send the browser to storage; old rows still carry the bytes
  if (row.path) return redirectToFile(row.path);
  return new Response(new Uint8Array(row.data!), { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable" } });
}
