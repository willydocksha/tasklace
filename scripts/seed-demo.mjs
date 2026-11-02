// seeds a demo board through the http api: node scripts/seed-demo.mjs [baseUrl]
const base = process.argv[2] || "http://localhost:3100";

async function session(name, email, password) {
  let res = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password }) });
  if (res.status === 409) res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = res.headers.get("set-cookie").split(";")[0];
  return async (path, method = "GET", data) => {
    const r = await fetch(base + path, { method, headers: { cookie, "content-type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
    const json = await r.json();
    if (!r.ok) throw new Error(`${method} ${path}: ${json.error}`);
    return json;
  };
}

const owner = await session("Demo Owner", "demo@rajutin.test", "demo1234");
const rina = await session("Rina Pratiwi", "rina@rajutin.test", "demo1234");

const { id } = await owner("/api/boards", "POST", { name: "Website Toko Online", color: "ocean", description: "Rilis v1 akhir tahun" });
const board = await owner(`/api/boards/${id}`);
await rina(`/api/boards/${id}`).catch(() => {});
await owner(`/api/boards/${id}/members`, "POST", { email: "rina@rajutin.test" });
const [backlog, todo, doing, review, done] = board.lists.map((l) => l.id);
const label = (n) => board.labels.find((l) => l.name === n).id;
const me = board.members[0].id;
const rinaId = (await owner(`/api/boards/${id}`)).members.find((m) => m.email.startsWith("rina")).id;

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
async function card(title, listId, type, extra = {}, parentId) {
  const { id: cid } = await owner(`/api/boards/${id}/cards`, "POST", { title, listId, type, parentId });
  if (Object.keys(extra).length) await owner(`/api/cards/${cid}`, "PATCH", extra);
  return cid;
}

const e1 = await card("Katalog & pencarian produk", doing, "epic", { start_date: day(-20), due_date: day(10), description: "Pembeli bisa menemukan produk dengan cepat." });
const e2 = await card("Checkout & pembayaran", todo, "epic", { start_date: day(5), due_date: day(40) });
const e3 = await card("Dashboard penjual", backlog, "epic", { start_date: day(35), due_date: day(70) });

await card("Halaman daftar produk dengan filter", done, "story", { labels: [label("Frontend")], assignees: [rinaId] }, e1);
await card("API pencarian full-text", review, "story", { labels: [label("Backend")], assignees: [me], due_date: day(2) }, e1);
await card("Desain kartu produk", done, "task", { labels: [label("Design")] }, e1);
await card("Hasil pencarian kosong tidak tampil pesan", doing, "bug", { priority: "high", labels: [label("Frontend")], assignees: [rinaId], due_date: day(-1) }, e1);
await card("Keranjang belanja", todo, "story", { labels: [label("Frontend")], assignees: [rinaId] }, e2);
await card("Integrasi payment gateway", todo, "story", { priority: "urgent", labels: [label("Backend"), label("Penting")], assignees: [me], due_date: day(20) }, e2);
await card("Email konfirmasi pesanan", backlog, "task", {}, e2);
await card("Grafik penjualan harian", backlog, "story", { labels: [label("Frontend")] }, e3);
await card("Setup CI/CD", doing, "task", { assignees: [me], labels: [label("Backend")] });
console.log(`seeded board ${base}/b/${id} (login demo@rajutin.test / demo1234)`);
