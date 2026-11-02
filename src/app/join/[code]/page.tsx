import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect(`/register?next=${encodeURIComponent(`/join/${code}`)}`);
  const [b] = await sql<{ id: string }[]>`select id from boards where invite_code = ${code}`;
  if (!b)
    return <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-600">Link undangan tidak valid atau sudah diganti oleh admin board.</div>;
  // join as a regular member; keep the existing role if already in
  await sql`insert into board_members (board_id, user_id, role) values (${b.id}, ${user.id}, 'member') on conflict do nothing`;
  redirect(`/b/${b.id}`);
}
