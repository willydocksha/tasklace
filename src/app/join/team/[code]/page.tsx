import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect(`/register?next=${encodeURIComponent(`/join/team/${code}`)}`);
  const [t] = await sql<{ id: string }[]>`select id from teams where invite_code = ${code}`;
  if (!t)
    return <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-600">Link undangan tim tidak valid atau sudah diganti oleh admin tim.</div>;
  // join as a regular member; keep the existing role if already in
  await sql`insert into team_members (team_id, user_id, role) values (${t.id}, ${user.id}, 'member') on conflict do nothing`;
  redirect(`/boards?team=${t.id}`);
}
