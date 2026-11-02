import { NextResponse } from "next/server";
import { createUser, startSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const { name, email, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!name?.trim() || !email?.includes("@") || !password || password.length < 6)
    return NextResponse.json({ error: "Isi nama, email valid, dan password minimal 6 karakter" }, { status: 400 });
  // reject duplicate emails before creating the account
  const [taken] = await sql`select 1 from users where email = ${email.trim().toLowerCase()}`;
  if (taken) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  const user = await createUser(name.trim(), email.trim(), password);
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}
