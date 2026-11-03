import { notFound, redirect } from "next/navigation";
import { boardRole } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { loadBoard } from "@/lib/board";
import { BoardClient } from "@/components/board/BoardClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/b/${id}`);
  // only members (direct or via a team) can open the board
  if (!(await boardRole(id, user.id))) notFound();
  return <BoardClient user={user} initial={await loadBoard(id, user.id)} />;
}
