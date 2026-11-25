import { body, HttpError, route } from "@/lib/api";
import { createToken, listTokens, revokeToken } from "@/lib/tokens";

// list the user's tokens (never the secret itself)
export const GET = route(({ user }) => listTokens(user.id));

// create a token; the plain value is shown once
export const POST = route(async ({ req, user }) => {
  const { name } = await body<{ name?: string }>(req);
  const n = name?.trim();
  if (!n || n.length > 60) throw new HttpError(400, "Nama token wajib diisi (maks 60 karakter)");
  if ((await listTokens(user.id)).length >= 20) throw new HttpError(400, "Maksimal 20 token, hapus yang tidak dipakai dulu");
  return createToken(user.id, n);
});

// revoke one token
export const DELETE = route(async ({ req, user }) => {
  const { id } = await body<{ id?: string }>(req);
  if (!id) throw new HttpError(400, "Id token wajib diisi");
  await revokeToken(user.id, id);
});
