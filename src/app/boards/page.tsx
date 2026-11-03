import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { BoardsClient } from "./BoardsClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/boards");
  // ?team=<id> opens that team right after joining it
  const { team } = await searchParams;
  return <BoardsClient user={user} openTeam={team} />;
}
