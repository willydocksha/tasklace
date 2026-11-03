import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { lastSentAgo, originOf, safeNext, sendVerification } from "@/lib/verify";

// resend the verification email; always answers ok so emails cannot be probed
export async function POST(req: Request) {
  const { email, next } = (await req.json().catch(() => ({}))) as Record<string, string>;
  const [u] = await sql<{ id: string; name: string; email: string; email_verified_at: number | null }[]>`
    select id, name, email, email_verified_at from users where email = ${(email ?? "").trim().toLowerCase()}`;
  if (u && !u.email_verified_at) {
    if ((await lastSentAgo(u.id)) < 60) return NextResponse.json({ error: "Tunggu 1 menit sebelum kirim ulang" }, { status: 429 });
    await sendVerification(u, originOf(req), safeNext(next)).catch((e) => console.error(e));
  }
  return NextResponse.json({ ok: true });
}
