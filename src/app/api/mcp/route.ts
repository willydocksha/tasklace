import { actingUser, boardOf } from "@/lib/api";
import type { User } from "@/lib/auth";
import { sql } from "@/lib/db";
import { userFromToken } from "@/lib/tokens";
import { GET as listBoards } from "../boards/route";
import { GET as getBoard } from "../boards/[id]/route";
import { POST as createCard } from "../boards/[id]/cards/route";
import { PATCH as patchCard } from "../cards/[id]/route";
import { GET as getComments, POST as postComment } from "../cards/[id]/comments/route";
import { GET as getActivity } from "../cards/[id]/activity/route";

// minimal mcp server (streamable http, stateless json): every tool runs the normal api handler
// as the token's user, so board permissions, status flow and activity log stay the same as in the app
export const dynamic = "force-dynamic";

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CARD_CODE = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/;

type Json = Record<string, unknown>;
type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

// call an existing route handler with a json body and return its parsed result
async function call(handler: Handler, method: string, id: string, data?: unknown) {
  const req = new Request("http://internal/api", {
    method,
    headers: { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const res = await handler(req, { params: Promise.resolve({ id }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Gagal (${res.status})`);
  return json;
}

// accept a card id or an issue code like TLC-12 (only boards the user can open)
async function cardId(user: User, ref: unknown) {
  const v = String(ref ?? "").trim();
  const m = CARD_CODE.exec(v);
  if (!m) return v;
  const rows = await sql<{ id: string }[]>`
    select c.id from cards c join boards b on b.id = c.board_id
    where upper(b.key) = ${m[1].toUpperCase()} and c.number = ${Number(m[2])}
      and c.board_id in (select board_id from board_access where user_id = ${user.id})`;
  if (rows.length !== 1) throw new Error(rows.length ? `Kode ${v} dipakai lebih dari satu board, pakai id kartu` : `Kartu ${v} tidak ditemukan`);
  return rows[0].id;
}

// shared field schema for creating and updating cards
const CARD_FIELDS = {
  description: { type: "string", description: "Deskripsi (markdown)" },
  type: { type: "string", enum: ["epic", "story", "task", "bug"] },
  priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
  points: { type: ["integer", "null"], description: "Story point 0-999" },
  start_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
  due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
  parent_id: { type: ["string", "null"], description: "Id kartu epic induknya" },
  sprint_id: { type: ["string", "null"], description: "Id sprint yang belum selesai" },
  labels: { type: "array", items: { type: "string" }, description: "Id label (mengganti semua label kartu)" },
  assignees: { type: "array", items: { type: "string" }, description: "Id user (mengganti semua assignee)" },
};
const PATCH_KEYS = ["title", ...Object.keys(CARD_FIELDS), "list_id"];

type Tool = { name: string; description: string; inputSchema: Json; run: (a: Json, user: User) => Promise<unknown> };

const TOOLS: Tool[] = [
  {
    name: "list_boards",
    description: "Daftar board Tasklace yang bisa dibuka user (id, nama, peran, jumlah kartu).",
    inputSchema: { type: "object", properties: {} },
    run: () => call(listBoards as unknown as Handler, "GET", ""),
  },
  {
    name: "get_board",
    description: "Isi satu board: list/status, label, member, sprint, dan ringkasan semua kartu (kode issue, judul, status, assignee). Pakai get_card untuk detail.",
    inputSchema: { type: "object", properties: { board_id: { type: "string" } }, required: ["board_id"] },
    run: async (a) => {
      const d = (await call(getBoard as unknown as Handler, "GET", String(a.board_id))) as {
        board: { id: string; name: string; description: string; key: string };
        lists: Json[]; labels: Json[]; members: Json[]; sprints: Json[]; role: string;
        cards: { id: string; number: number | null; title: string; type: string; priority: string; list_id: string; sprint_id: string | null; parent_id: string | null; points: number | null; due_date: string | null; labels: string[]; assignees: string[] }[];
      };
      return {
        board: { id: d.board.id, name: d.board.name, description: d.board.description, key: d.board.key, your_role: d.role },
        lists: d.lists, labels: d.labels, sprints: d.sprints,
        members: d.members.map((m) => ({ id: m.id, name: m.name, username: m.username, role: m.role })),
        cards: d.cards.map((c) => ({
          id: c.id, code: c.number ? `${d.board.key}-${c.number}` : null, title: c.title, type: c.type, priority: c.priority,
          list_id: c.list_id, sprint_id: c.sprint_id, parent_id: c.parent_id, points: c.points, due_date: c.due_date, labels: c.labels, assignees: c.assignees,
        })),
      };
    },
  },
  {
    name: "get_card",
    description: "Detail satu kartu: deskripsi, field lengkap, komentar, dan riwayat aktivitas. Terima id kartu atau kode issue seperti TLC-12.",
    inputSchema: { type: "object", properties: { card: { type: "string", description: "Id kartu atau kode issue" } }, required: ["card"] },
    run: async (a, user) => {
      const id = await cardId(user, a.card);
      await boardOf("cards", id, user.id);
      const [card] = await sql`
        select c.id, b.key || '-' || c.number as code, c.board_id, c.list_id, c.type, c.title, c.description, c.priority, c.points,
          c.start_date, c.due_date, c.parent_id, c.sprint_id,
          coalesce((select array_agg(label_id) from card_labels where card_id = c.id), '{}') as labels,
          coalesce((select array_agg(user_id) from card_assignees where card_id = c.id), '{}') as assignees
        from cards c join boards b on b.id = c.board_id where c.id = ${id}`;
      const [comments, activity] = await Promise.all([call(getComments as unknown as Handler, "GET", id), call(getActivity as unknown as Handler, "GET", id)]);
      return { card, comments, activity };
    },
  },
  {
    name: "create_card",
    description: "Buat kartu baru di board. Tanpa list_id, kartu masuk ke list pertama. Butuh izin membuat kartu.",
    inputSchema: {
      type: "object",
      properties: { board_id: { type: "string" }, title: { type: "string" }, list_id: { type: "string", description: "Id list/status tujuan" }, ...CARD_FIELDS },
      required: ["board_id", "title"],
    },
    run: async (a) => {
      const board = String(a.board_id);
      const made = (await call(createCard as unknown as Handler, "POST", board, { title: a.title, listId: a.list_id, type: a.type, parentId: a.parent_id, sprintId: a.sprint_id })) as { id: string };
      // fields the create route does not take are set right after
      const extra: Json = {};
      for (const k of ["description", "priority", "points", "start_date", "due_date", "labels", "assignees"]) if (a[k] !== undefined) extra[k] = a[k];
      if (Object.keys(extra).length) await call(patchCard as unknown as Handler, "PATCH", made.id, extra);
      return made;
    },
  },
  {
    name: "update_card",
    description: "Ubah kartu: judul, deskripsi, tipe, prioritas, poin, tanggal, label, assignee, epic, sprint, atau pindah status lewat list_id (mengikuti alur status board). Kartu di list Done terkunci.",
    inputSchema: {
      type: "object",
      properties: { card: { type: "string", description: "Id kartu atau kode issue" }, title: { type: "string" }, list_id: { type: "string", description: "Pindahkan ke list/status ini" }, ...CARD_FIELDS },
      required: ["card"],
    },
    run: async (a, user) => {
      const id = await cardId(user, a.card);
      const patch: Json = {};
      for (const k of PATCH_KEYS) if (a[k] !== undefined) patch[k] = a[k];
      if (!Object.keys(patch).length) throw new Error("Tidak ada field yang diubah");
      await call(patchCard as unknown as Handler, "PATCH", id, patch);
      return { ok: true, id };
    },
  },
  {
    name: "add_comment",
    description: "Tulis komentar di kartu (atas nama pemilik token).",
    inputSchema: { type: "object", properties: { card: { type: "string", description: "Id kartu atau kode issue" }, text: { type: "string" } }, required: ["card", "text"] },
    run: async (a, user) => {
      await call(postComment as unknown as Handler, "POST", await cardId(user, a.card), { text: a.text });
      return { ok: true };
    },
  },
];

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// answer one json-rpc message; null for notifications
async function handle(msg: Json, user: User) {
  const { id, method } = msg as { id?: unknown; method?: string };
  const params = (msg.params ?? {}) as Json;
  if (id === undefined) return null;
  switch (method) {
    case "initialize": {
      const asked = String(params.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "tasklace", version: "0.1.0" },
        instructions: `Terhubung ke Tasklace sebagai ${user.name}. Mulai dari list_boards, lalu get_board untuk melihat list, label, dan kartu.`,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return fail(id, -32602, `Tool tidak dikenal: ${String(params.name)}`);
      try {
        // run as the token's user so the normal permission checks apply
        const out = await actingUser.run(user, () => tool.run((params.arguments ?? {}) as Json, user));
        return ok(id, { content: [{ type: "text", text: JSON.stringify(out) }] });
      } catch (e) {
        return ok(id, { isError: true, content: [{ type: "text", text: (e as Error).message }] });
      }
    }
    default:
      return fail(id, -32601, `Method tidak dikenal: ${String(method)}`);
  }
}

export async function POST(req: Request) {
  // bearer token from Settings > Profil > Token API
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1]?.trim();
  const user = token ? await userFromToken(token) : null;
  if (!user) return Response.json({ error: "Token tidak valid" }, { status: 401, headers: { "www-authenticate": 'Bearer realm="tasklace"' } });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json(fail(null, -32700, "JSON tidak valid"), { status: 400 });
  }
  // single message or batch
  if (Array.isArray(payload)) {
    const out = (await Promise.all(payload.map((m) => handle(m as Json, user)))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const out = await handle(payload as Json, user);
  return out ? Response.json(out) : new Response(null, { status: 202 });
}

// no server-initiated stream in this stateless server
export const GET = () => new Response(null, { status: 405, headers: { allow: "POST" } });
