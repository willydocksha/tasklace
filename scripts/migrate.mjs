// applies db/schema.sql to DATABASE_URL (usage: npm run db:migrate)
import fs from "node:fs";
import postgres from "postgres";

// --deploy (used by the build): only migrate on vercel production builds, skip previews and local builds
if (process.argv.includes("--deploy") && process.env.VERCEL_ENV !== "production") {
  console.log(`migrate skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "local"})`);
  process.exit(0);
}

// read the connection string from env or .env.local
let url = process.env.DATABASE_URL;
if (!url && fs.existsSync(".env.local")) url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL belum diisi (env atau .env.local)");
  process.exit(1);
}

// run the whole schema file in one go
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
await sql.unsafe(fs.readFileSync("db/schema.sql", "utf8"));
await sql.end();
console.log("schema ok");
