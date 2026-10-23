import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { BoardsClient } from "./BoardsClient";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/boards");
  return <BoardsClient user={user} />;
}
