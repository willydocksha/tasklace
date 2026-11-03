import { body, requireMember, route } from "@/lib/api";
import { newId, sql } from "@/lib/db";

// create a planned sprint, named "Sprint N" unless given
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  await requireMember(params.id, user.id);
  const b = await body<{ name?: string }>(req).catch(() => ({}) as { name?: string });
  const [{ n }] = await sql<{ n: number }[]>`select count(*) + 1 as n from sprints where board_id = ${params.id}`;
  const id = newId();
  await sql`insert into sprints (id, board_id, name, created_at) values (${id}, ${params.id}, ${b.name?.trim() || `Sprint ${n}`}, ${Date.now()})`;
  return { id };
});
