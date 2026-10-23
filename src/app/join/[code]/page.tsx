import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect(`/register?next=${encodeURIComponent(`/join/${code}`)}`);
  const b = db.prepare("select id, name from boards where invite_code = ?").get(code) as { id: string; name: string } | undefined;
  if (!b)
    return <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-600">Link undangan tidak valid atau sudah diganti oleh admin board.</div>;
  db.prepare("insert or ignore into board_members (board_id, user_id, role) values (?, ?, 'member')").run(b.id, user.id);
  redirect(`/b/${b.id}`);
}
