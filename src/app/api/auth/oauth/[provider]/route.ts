import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/oauth";
import { originOf, safeNext } from "@/lib/verify";

// start sign-in: remember state + next in a short-lived cookie, then go to the provider
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = PROVIDERS[provider];
  const origin = originOf(req);
  if (!p?.clientId) return NextResponse.redirect(`${origin}/login?error=oauth`);
  const state = crypto.randomUUID();
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  (await cookies()).set("tl_oauth", JSON.stringify({ state, next, provider }), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 600,
  });
  const url = new URL(p.authorize);
  url.search = new URLSearchParams({ client_id: p.clientId, redirect_uri: `${origin}/api/auth/oauth/${provider}/callback`, scope: p.scope, state, response_type: "code" }).toString();
  return NextResponse.redirect(url.toString());
}
