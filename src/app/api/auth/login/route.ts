import { NextResponse } from "next/server";
import { checkPassword, startSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  // look up the account and verify the password
  const [row] = await sql<{ id: string; password_hash: string | null; email_verified_at: number | null }[]>`
    select id, password_hash, email_verified_at from users where email = ${(email ?? "").trim().toLowerCase()}`;
  if (row && !row.password_hash)
    return NextResponse.json({ error: "Akun ini masuk lewat GitHub atau Google. Pakai tombol di bawah." }, { status: 400 });
  if (!row || !(await checkPassword(password ?? "", row.password_hash!)))
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  // the email must be confirmed first
  if (!row.email_verified_at)
    return NextResponse.json({ error: "Email belum diverifikasi. Cek inbox (atau folder spam) kamu.", unverified: true }, { status: 403 });
  await startSession(row.id);
  return NextResponse.json({ ok: true });
}
