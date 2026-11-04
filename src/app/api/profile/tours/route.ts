import { body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";

// mark an onboarding tour as seen (finished or skipped)
export const POST = route(async ({ req, user }) => {
  const { id } = await body<{ id?: string }>(req);
  if (!id || !/^[a-z0-9-]{1,40}$/.test(id)) throw new HttpError(400, "Tour tidak valid");
  await sql`update users set tours_seen = array_append(tours_seen, ${id}) where id = ${user.id} and not (${id} = any(tours_seen))`;
});
