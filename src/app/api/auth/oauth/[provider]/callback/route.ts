import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createUser, startSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PROVIDERS } from "@/lib/oauth";
import { originOf } from "@/lib/verify";

// provider sends the user back here with a code
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = originOf(req);
  const fail = () => NextResponse.redirect(`${origin}/login?error=oauth`);
  const p = PROVIDERS[provider];
  const q = new URL(req.url).searchParams;
  const jar = await cookies();

  // the state must match what we set when sign-in started
  let saved: { state: string; next: string; provider: string } | null = null;
  try {
    saved = JSON.parse(jar.get("tl_oauth")?.value ?? "null");
  } catch {}
  jar.delete("tl_oauth");
  if (!p?.clientId || !saved || saved.provider !== provider || saved.state !== q.get("state") || !q.get("code")) return fail();

  let profile;
  try {
    profile = await p.profile(q.get("code")!, `${origin}/api/auth/oauth/${provider}/callback`, p);
  } catch (e) {
    console.error(e);
    return fail();
  }

  // known identity -> that user; else same verified email -> link; else new account
  const email = profile.email.toLowerCase();
  const [linked] = await sql<{ user_id: string }[]>`select user_id from oauth_accounts where provider = ${provider} and provider_user_id = ${profile.id}`;
  let userId = linked?.user_id;
  if (!userId) {
    const [existing] = await sql<{ id: string }[]>`select id from users where email = ${email}`;
    userId = existing?.id ?? (await createUser(profile.name.slice(0, 80), email, null, true)).id;
    await sql`insert into oauth_accounts (provider, provider_user_id, user_id, created_at) values (${provider}, ${profile.id}, ${userId}, ${Date.now()}) on conflict do nothing`;
  }
  // the provider vouched for this email. a password set on a never-verified account
  // could belong to someone who squatted the address, so it is dropped.
  await sql`update users set password_hash = case when email_verified_at is null then null else password_hash end,
    email_verified_at = coalesce(email_verified_at, ${Date.now()}) where id = ${userId}`;
  // use the provider picture until the user picks a photo
  if (profile.avatar?.startsWith("https://")) await sql`update users set avatar_url = ${profile.avatar} where id = ${userId} and avatar_url is null`;
  await startSession(userId);
  return NextResponse.redirect(`${origin}${saved.next}`);
}
