import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mailMode } from "@/lib/mail";
import { ProfileClient } from "./ProfileClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/profile");
  // password state, linked providers and a pending email change
  const [[row], providers, [pending]] = await Promise.all([
    sql<{ has_password: boolean }[]>`select password_hash is not null as has_password from users where id = ${user.id}`,
    sql<{ provider: string }[]>`select provider from oauth_accounts where user_id = ${user.id} order by provider`,
    sql<{ data: string }[]>`select data from email_tokens where user_id = ${user.id} and purpose = 'email' and expires_at > ${Date.now()}`,
  ]);
  const { email } = await searchParams;
  return (
    <ProfileClient
      user={user}
      hasPassword={row.has_password}
      providers={providers.map((p) => p.provider)}
      pendingEmail={pending?.data ?? null}
      emailResult={email === "changed" || email === "invalid" ? email : null}
      instantEmail={mailMode === "off"}
    />
  );
}
