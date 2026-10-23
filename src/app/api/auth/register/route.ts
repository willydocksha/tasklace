import { NextResponse } from "next/server";
import { createUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { name, email, password } = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!name?.trim() || !email?.includes("@") || !password || password.length < 6)
    return NextResponse.json({ error: "Isi nama, email valid, dan password minimal 6 karakter" }, { status: 400 });
  if (db.prepare("select 1 from users where email = ?").get(email.toLowerCase()))
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  const user = createUser(name.trim(), email.trim(), password);
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}
