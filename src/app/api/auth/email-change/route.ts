import { NextResponse } from "next/server";
import { consumeEmailChange, originOf } from "@/lib/verify";

// the link from the new address: switch the account email, back to the profile page
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = token ? await consumeEmailChange(token) : null;
  return NextResponse.redirect(`${originOf(req)}/profile?email=${ok ? "changed" : "invalid"}`);
}
