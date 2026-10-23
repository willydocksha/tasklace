import { NextResponse } from "next/server";
import { checkPassword, startSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  const row = db.prepare("select id, password_hash from users where email = ?").get((email ?? "").trim().toLowerCase()) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row || !checkPassword(password ?? "", row.password_hash))
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  await startSession(row.id);
  return NextResponse.json({ ok: true });
}
