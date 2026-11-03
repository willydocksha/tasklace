import { NextResponse } from "next/server";
import { createUser, startSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mailMode } from "@/lib/mail";
import { originOf, safeNext, sendVerification } from "@/lib/verify";

export async function POST(req: Request) {
  const { name, email, password, next } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!name?.trim() || !email?.includes("@") || !password || password.length < 6)
    return NextResponse.json({ error: "Isi nama, email valid, dan password minimal 6 karakter" }, { status: 400 });
  // reject duplicate emails before creating the account
  const [taken] = await sql`select 1 from users where email = ${email.trim().toLowerCase()}`;
  if (taken) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });

  // without an email service, accounts are active right away
  if (mailMode === "off") {
    const user = await createUser(name.trim(), email.trim(), password, true);
    await startSession(user.id);
    return NextResponse.json({ ok: true });
  }

  // otherwise the account waits for the emailed link
  const user = await createUser(name.trim(), email.trim(), password);
  try {
    await sendVerification(user, originOf(req), safeNext(next));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Akun dibuat, tapi email verifikasi gagal dikirim. Coba kirim ulang dari halaman masuk." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, verify: true });
}
