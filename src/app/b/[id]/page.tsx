import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loadBoard } from "@/lib/board";
import { db } from "@/lib/db";
import { BoardClient } from "@/components/board/BoardClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/b/${id}`);
  if (!db.prepare("select 1 from board_members where board_id = ? and user_id = ?").get(id, user.id)) notFound();
  return <BoardClient user={user} initial={loadBoard(id, user.id)} />;
}
