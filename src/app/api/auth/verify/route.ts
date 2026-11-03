import { NextResponse } from "next/server";
import { startSession } from "@/lib/auth";
import { consumeVerification, originOf } from "@/lib/verify";

// the link from the email: confirm, sign the user in, and continue
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const r = token ? await consumeVerification(token) : null;
  if (!r) return NextResponse.redirect(`${originOf(req)}/login?error=verify`);
  await startSession(r.userId);
  return NextResponse.redirect(`${originOf(req)}${r.next}`);
}
