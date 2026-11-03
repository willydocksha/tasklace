"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client";

type Provider = { id: string; label: string };

const ERRORS: Record<string, string> = {
  verify: "Link verifikasi tidak valid atau sudah kedaluwarsa. Masuk untuk kirim ulang.",
  oauth: "Gagal masuk lewat GitHub/Google. Coba lagi.",
};

// provider logos as small inline svgs
const ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  ),
};

export function AuthForm({ mode, providers }: { mode: "login" | "register"; providers: Provider[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/boards";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(ERRORS[params.get("error") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  // set once the account needs email confirmation
  const [sentTo, setSentTo] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [note, setNote] = useState("");
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setUnverified(false);
    try {
      const r = await api<{ verify?: boolean }>(`/api/auth/${mode}`, "POST", { ...form, next });
      if (r.verify) {
        setSentTo(form.email);
        setBusy(false);
        return;
      }
      router.push(next.startsWith("/") ? next : "/boards");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setUnverified(err instanceof ApiError && !!err.data.unverified);
      setBusy(false);
    }
  }

  // ask for another verification email
  async function resend(email: string) {
    setNote("");
    try {
      await api("/api/auth/resend", "POST", { email, next });
      setNote("Email verifikasi dikirim ulang.");
    } catch (err) {
      setNote((err as Error).message);
    }
  }

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#0c66e4,#0747a6 60%,#09326c)" }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">{children}</div>
    </div>
  );

  // after registering: tell the user to open their inbox
  if (sentTo)
    return shell(
      <div className="space-y-4 text-center">
        <div className="text-4xl">📬</div>
        <h1 className="text-xl font-bold text-slate-800">Cek email kamu</h1>
        <p className="text-sm text-slate-600">
          Kami kirim link verifikasi ke <b>{sentTo}</b>. Klik link itu, dan kamu langsung masuk ke Rajutin.
        </p>
        <p className="text-xs text-slate-400">Tidak ada? Cek folder spam, atau kirim ulang.</p>
        <button onClick={() => resend(sentTo)} className="w-full rounded-lg border border-blue-200 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
          Kirim ulang email
        </button>
        {note && <p className="text-sm text-slate-600">{note}</p>}
        <Link href="/login" className="block text-sm text-slate-500 hover:underline">
          Kembali ke halaman masuk
        </Link>
      </div>,
    );

  return shell(
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center">
        <div className="text-3xl">🧶</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">Rajutin</h1>
        <p className="text-sm text-slate-500">{isLogin ? "Masuk ke akunmu" : "Buat akun gratis, tanpa batas member"}</p>
      </div>

      {providers.length > 0 && (
        <>
          <div className="space-y-2">
            {providers.map((p) => (
              <a key={p.id} href={`/api/auth/oauth/${p.id}?next=${encodeURIComponent(next)}`} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {ICONS[p.id]} {isLogin ? "Masuk" : "Daftar"} dengan {p.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> atau pakai email <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      {!isLogin && <input className={field} placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
      <input className={field} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input className={field} type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={isLogin ? 1 : 6} />
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
          {unverified && (
            <button type="button" onClick={() => resend(form.email)} className="mt-1 block font-medium text-blue-700 underline">
              Kirim ulang email verifikasi
            </button>
          )}
        </div>
      )}
      {note && <p className="text-sm text-slate-600">{note}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {busy ? "Memproses…" : isLogin ? "Masuk" : "Daftar"}
      </button>
      <p className="text-center text-sm text-slate-500">
        {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
        <Link className="font-medium text-blue-600 hover:underline" href={`/${isLogin ? "register" : "login"}${next !== "/boards" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          {isLogin ? "Daftar" : "Masuk"}
        </Link>
      </p>
    </form>,
  );
}
