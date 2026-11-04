// moves image bytes from postgres (bytea columns) into supabase storage, then clears those columns.
// usage: npm run images:move            (reads .env.local; safe to re-run, only touches rows not moved yet)
//        npm run images:move -- --vacuum (also runs vacuum full so the database actually shrinks)
import postgres from "postgres";

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "tasklace";
if (!DATABASE_URL || !URL || !KEY) {
  console.error("butuh DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
const enc = (path) => path.split("/").map(encodeURIComponent).join("/");

// call the storage rest api with the service key
async function api(path, init = {}) {
  const res = await fetch(`${URL}/storage/v1${path}`, { ...init, headers: { apikey: KEY, authorization: `Bearer ${KEY}`, ...init.headers } });
  if (!res.ok) throw new Error(`storage ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text().catch(() => "")}`);
  return res;
}

// create the private bucket if it is not there yet
async function ensureBucket() {
  const res = await fetch(`${URL}/storage/v1/bucket/${BUCKET}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (res.ok) return console.log(`bucket "${BUCKET}" sudah ada`);
  await api("/bucket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
  console.log(`bucket "${BUCKET}" dibuat (private)`);
}

// upload one object (overwrites, so a re-run after a crash is fine)
const put = (path, mime, bytes) =>
  api(`/object/${BUCKET}/${enc(path)}`, { method: "POST", body: bytes, headers: { "content-type": mime, "cache-control": "max-age=31536000", "x-upsert": "true" } });

// remove objects (used when a row changed while we were uploading)
const remove = (paths) => api(`/object/${BUCKET}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefixes: paths }) });

// same object keys as the app uses (see src/app/api/**)
const TABLES = [
  { table: "user_avatars", key: "user_id", thumb: false, path: (r) => `avatars/user/${r.user_id}-${r.updated_at}` },
  { table: "team_avatars", key: "team_id", thumb: false, path: (r) => `avatars/team/${r.team_id}-${r.updated_at}` },
  { table: "board_backgrounds", key: "board_id", thumb: true, path: (r) => `backgrounds/${r.board_id}-${r.updated_at}` },
  { table: "card_attachments", key: "id", thumb: true, path: (r) => `attachments/${r.id}` },
];

// database size, for the before/after report
const dbSize = async () => (await sql`select pg_size_pretty(pg_database_size(current_database())) as s`)[0].s;

// the path columns come from db/schema.sql; stop early if it was not applied yet
const [{ ready }] = await sql`select count(*) = 4 as ready from information_schema.columns
  where column_name = 'path' and table_name in ('user_avatars', 'team_avatars', 'board_backgrounds', 'card_attachments')`;
if (!ready) {
  console.error("kolom path belum ada: jalankan dulu `npm run db:migrate` (atau deploy), lalu ulangi script ini");
  await sql.end();
  process.exit(1);
}

console.log(`ukuran database awal: ${await dbSize()}`);
await ensureBucket();

// move each table in small batches until no row with bytes is left
for (const t of TABLES) {
  let moved = 0;
  let bytes = 0;
  for (;;) {
    const rows = await sql`select * from ${sql(t.table)} where path is null and data is not null limit 10`;
    if (!rows.length) break;
    for (const r of rows) {
      const path = t.path(r);
      await put(path, r.mime, r.data);
      if (t.thumb && r.thumb) await put(`${path}.thumb`, r.mime, r.thumb);
      // only claim rows nobody replaced meanwhile; otherwise drop what we just uploaded
      const done = await sql`update ${sql(t.table)} set path = ${path}, data = null ${t.thumb ? sql`, thumb = null` : sql``}
        where ${sql(t.key)} = ${r[t.key]} and path is null returning 1`;
      if (!done.length) await remove(t.thumb ? [path, `${path}.thumb`] : [path]);
      else {
        moved++;
        bytes += r.data.length + (r.thumb?.length ?? 0);
      }
    }
    process.stdout.write(`\r${t.table}: ${moved} dipindah`);
  }
  console.log(`\r${t.table}: ${moved} dipindah (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

// reclaim the space; plain delete/update leaves it allocated
if (process.argv.includes("--vacuum")) {
  for (const t of TABLES) {
    try {
      await sql.unsafe(`vacuum full ${t.table}`);
      console.log(`vacuum full ${t.table} ok`);
    } catch (e) {
      console.error(`vacuum full ${t.table} gagal: ${e.message} (jalankan manual di SQL editor Supabase)`);
    }
  }
}

console.log(`ukuran database akhir: ${await dbSize()}`);
await sql.end();
