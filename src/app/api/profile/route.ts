import { body, HttpError, route } from "@/lib/api";
import { sql } from "@/lib/db";

const USERNAME = /^[a-z0-9_.]{3,30}$/;

// update display name and username
export const PATCH = route(async ({ req, user }) => {
  const b = await body<{ name?: string; username?: string | null }>(req);
  if (b.name !== undefined) {
    const name = b.name.trim();
    if (!name || name.length > 80) throw new HttpError(400, "Nama wajib diisi (maks 80 karakter)");
    await sql`update users set name = ${name} where id = ${user.id}`;
  }
  if (b.username !== undefined) {
    // empty clears it; otherwise lowercase, unique
    const u = (b.username ?? "").trim().replace(/^@/, "").toLowerCase() || null;
    if (u && !USERNAME.test(u)) throw new HttpError(400, "Username 3-30 karakter: huruf kecil, angka, titik atau garis bawah");
    if (u) {
      const [taken] = await sql`select 1 from users where lower(username) = ${u} and id <> ${user.id}`;
      if (taken) throw new HttpError(409, "Username sudah dipakai");
    }
    await sql`update users set username = ${u} where id = ${user.id}`;
  }
  const [row] = await sql`select name, username from users where id = ${user.id}`;
  return row;
});
