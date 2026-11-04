import { notFound, redirect } from "next/navigation";
import { boardRole } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { loadBoard } from "@/lib/board";
import { BoardClient } from "@/components/board/BoardClient";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ card?: string }> }) {
  const { id } = await params;
  const { card } = await searchParams;
  const user = await currentUser();
  // keep a shared card link through the login page
  if (!user) redirect(`/login?next=${encodeURIComponent(`/b/${id}${card ? `?card=${encodeURIComponent(card)}` : ""}`)}`);
  // only members (direct or via a team) can open the board
  if (!(await boardRole(id, user.id))) notFound();
  return <BoardClient user={user} initial={await loadBoard(id, user.id)} />;
}
