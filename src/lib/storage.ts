// image files in supabase storage (server only). rows keep the object path; the bytes live in the bucket.
// without SUPABASE_SERVICE_ROLE_KEY, uploads fall back to bytea columns (old behavior, handy for local dev).
import { after } from "next/server";
import { sql } from "@/lib/db";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "tasklace";

// signed urls live a day; redirects to them are cached an hour less
const SIGN_TTL = 24 * 3600;

export const storageEnabled = !!(URL && KEY);

// encode each path segment, keep the slashes
const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

// call the storage rest api with the service key; throws with the response text on failure
async function api(path: string, init: RequestInit & { headers?: Record<string, string> }) {
  const res = await fetch(`${URL}/storage/v1${path}`, {
    ...init,
    headers: { apikey: KEY!, authorization: `Bearer ${KEY}`, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`storage ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text().catch(() => "")}`);
  return res;
}

// json body helper
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

// create the private bucket (first upload on a fresh project)
async function createBucket() {
  await api("/bucket", json("POST", { id: BUCKET, name: BUCKET, public: false })).catch((e) => {
    // another request may have created it meanwhile
    if (!String(e).includes("already exists")) throw e;
  });
}

// upload one object (overwrites); creates the bucket once if it is missing
async function putFile(path: string, data: Blob | Uint8Array, mime: string) {
  const send = () =>
    api(`/object/${BUCKET}/${enc(path)}`, {
      method: "POST",
      body: data as BodyInit,
      headers: { "content-type": mime, "cache-control": "max-age=31536000", "x-upsert": "true" },
    });
  try {
    await send();
  } catch (e) {
    if (!/bucket not found/i.test(String(e))) throw e;
    await createBucket();
    await send();
  }
}

// store an image (and its thumbnail at path + ".thumb"); returns the path, or null when storage is off
export async function storeImage(path: string, mime: string, data: Blob | Uint8Array, thumb?: Blob | Uint8Array) {
  if (!storageEnabled) return null;
  await putFile(path, data, mime);
  if (thumb) await putFile(`${path}.thumb`, thumb, mime);
  return path;
}

// copy objects inside the bucket, a few at a time
export async function copyFiles(pairs: [from: string, to: string][]) {
  for (let i = 0; i < pairs.length; i += 8)
    await Promise.all(pairs.slice(i, i + 8).map(([from, to]) => api("/object/copy", json("POST", { bucketId: BUCKET, sourceKey: from, destinationKey: to }))));
}

// redirect the browser to a short-lived signed url (served by supabase's cdn).
// download = file name to force a save dialog (the html download attribute is ignored cross-origin)
export async function redirectToFile(path: string, download?: string) {
  const res = await api(`/object/sign/${BUCKET}/${enc(path)}`, json("POST", { expiresIn: SIGN_TTL }));
  const { signedURL } = (await res.json()) as { signedURL: string };
  let url = `${URL}/storage/v1${signedURL}`;
  if (download) url += `&download=${encodeURIComponent(download)}`;
  return new Response(null, { status: 302, headers: { location: url, "cache-control": `private, max-age=${SIGN_TTL - 3600}` } });
}

// delete objects whose rows are gone (queued by the trash_stored_file trigger)
export async function purgeTrash() {
  if (!storageEnabled) return;
  const rows = await sql<{ path: string }[]>`select path from storage_trash order by created_at limit 1000`;
  if (!rows.length) return;
  const paths = rows.map((r) => r.path);
  await api(`/object/${BUCKET}`, json("DELETE", { prefixes: paths }));
  await sql`delete from storage_trash where path in ${sql(paths)}`;
}

// run purgeTrash after the response is sent; failures stay queued for the next run
export function purgeLater() {
  after(() => purgeTrash().catch((e) => console.error("purge storage trash", e)));
}
