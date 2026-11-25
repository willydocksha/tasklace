"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { TokenInfo } from "@/lib/tokens";

const INPUT =
  "h-10 w-full rounded-lg border border-slate-200 bg-surface px-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-3 focus:ring-blue-100 disabled:opacity-60";
const PRIMARY = "h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 dark:hover:bg-blue-500";
const GHOST = "h-8 rounded-lg border border-slate-200 bg-surface px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60";

// copyable code block
function Code({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-100 px-3 py-2.5 pr-16 text-xs text-slate-800">{text}</pre>
      <button
        type="button"
        className={`${GHOST} absolute top-1.5 right-1.5 h-7 px-2 text-xs`}
        onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      >
        {copied ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}

// personal access tokens that let an AI client (claude code, cursor, etc.) use the MCP endpoint
export function TokenSection() {
  const [tokens, setTokens] = useState<TokenInfo[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = () => api<TokenInfo[]>("/api/profile/tokens").then(setTokens).catch(() => setTokens([]));
  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string }>("/api/profile/tokens", "POST", { name });
      setFresh(r.token);
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Hapus token ini? AI yang memakainya langsung kehilangan akses.")) return;
    await api("/api/profile/tokens", "DELETE", { id });
    setFresh(null);
    await load();
  }

  const url = `${origin}/api/mcp`;
  const token = fresh ?? "<TOKEN>";
  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">Token API &amp; MCP</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Pasang AI (Claude Code, Claude, Cursor, dll.) ke Tasklace lewat MCP. AI bekerja atas namamu, dengan izin yang sama seperti di aplikasi.
      </p>

      <form onSubmit={create} className="mt-4 flex gap-2">
        <input className={INPUT} value={name} maxLength={60} placeholder="Nama token, mis. Claude Code laptop" onChange={(e) => setName(e.target.value)} />
        <button disabled={busy || !name.trim()} className={`${PRIMARY} shrink-0`}>
          {busy ? "Membuat…" : "Buat token"}
        </button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {fresh && (
        <div className="mt-4 space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p>Salin token ini sekarang. Setelah halaman ditutup, token tidak bisa dilihat lagi.</p>
          <Code text={fresh} />
        </div>
      )}

      {tokens && tokens.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-400">
                  {t.prefix}… · dibuat {new Date(t.created_at).toLocaleDateString("id-ID")} ·{" "}
                  {t.last_used_at ? `terakhir dipakai ${new Date(t.last_used_at).toLocaleDateString("id-ID")}` : "belum pernah dipakai"}
                </p>
              </div>
              <button className={GHOST} onClick={() => revoke(t.id)}>
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-3">
        <p className="text-sm font-medium text-slate-700">Cara pasang</p>
        <p className="text-xs text-slate-500">Claude Code:</p>
        <Code text={`claude mcp add --transport http tasklace ${url} --header "Authorization: Bearer ${token}"`} />
        <p className="text-xs text-slate-500">Klien lain (file konfigurasi MCP):</p>
        <Code text={JSON.stringify({ mcpServers: { tasklace: { type: "http", url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)} />
      </div>
    </section>
  );
}
