import postgres from "postgres";

// open a pool; supabase's transaction pooler (port 6543) needs prepare off
function open() {
  return postgres(process.env.DATABASE_URL ?? "", {
    prepare: false,
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    // return bigint columns and count(*) as plain numbers
    types: {
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
}

// reuse one pool across hot reloads in dev
const g = globalThis as unknown as { __sql?: postgres.Sql };
export const sql = g.__sql ?? (g.__sql = open());

// sql or a transaction-scoped sql
export type Sql = postgres.Sql | postgres.TransactionSql;

export const newId = () => crypto.randomUUID();
