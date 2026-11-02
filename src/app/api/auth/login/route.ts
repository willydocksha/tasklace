import { NextResponse } from "next/server";
import { checkPassword, startSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  // look up the account and verify the password
  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from users where email = ${(email ?? "").trim().toLowerCase()}`;
  if (!row || !(await checkPassword(password ?? "", row.password_hash)))
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  await startSession(row.id);
  return NextResponse.json({ ok: true });
}
