// one-off: turn :emoji: shortcodes already stored in cards, comments, lists and boards into real emoji
// usage: node --experimental-strip-types scripts/fix-emoji.mjs [--write]   (dry run without --write)
import fs from "node:fs";
import postgres from "postgres";
import { decodeEmoji } from "../src/lib/emoji.ts";

// read the connection string from env or .env.local (same as migrate.mjs)
let url = process.env.DATABASE_URL;
if (!url && fs.existsSync(".env.local")) url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL belum diisi (env atau .env.local)");
  process.exit(1);
}
const write = process.argv.includes("--write");
console.log(`${write ? "WRITE" : "dry run"} on ${new URL(url).host}`);

// table -> text columns that may hold shortcodes
const TARGETS = [
  ["cards", ["title", "description"]],
  ["comments", ["body"]],
  ["lists", ["name"]],
  ["boards", ["description"]],
];

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
let total = 0;
for (const [table, cols] of TARGETS) {
  // only rows that contain something shaped like :name:
  const where = cols.map((c) => `${c} ~ ':[a-zA-Z0-9_+-]+:'`).join(" or ");
  const rows = await sql.unsafe(`select id, ${cols.join(", ")} from ${table} where ${where}`);
  let changed = 0;
  for (const row of rows) {
    // decode each column and keep only the ones that actually changed
    const patch = {};
    for (const c of cols) if (row[c] != null && decodeEmoji(row[c]) !== row[c]) patch[c] = decodeEmoji(row[c]);
    if (!Object.keys(patch).length) continue;
    changed++;
    if (changed <= 3) console.log(`  ${table} ${row.id}:`, Object.values(patch)[0].slice(0, 80).replace(/\n/g, " "));
    if (write) await sql`update ${sql(table)} set ${sql(patch)} where id = ${row.id}`;
  }
  console.log(`${table}: ${changed} row(s) ${write ? "updated" : "would change"}`);
  total += changed;
}
await sql.end();
console.log(`total ${total}${write ? "" : " (run again with --write to apply)"}`);
