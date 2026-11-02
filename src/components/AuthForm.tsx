"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/boards";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, "POST", form);
      router.push(next.startsWith("/") ? next : "/boards");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#0c66e4,#5e4db2)" }}>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          <div className="text-3xl">🧶</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">Rajutin</h1>
          <p className="text-sm text-slate-500">{isLogin ? "Masuk ke akunmu" : "Buat akun gratis, tanpa batas member"}</p>
        </div>
        {!isLogin && <input className={field} placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
        <input className={field} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={field} type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={isLogin ? 1 : 6} />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Memproses…" : isLogin ? "Masuk" : "Daftar"}
        </button>
        <p className="text-center text-sm text-slate-500">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <Link className="font-medium text-blue-600 hover:underline" href={`/${isLogin ? "register" : "login"}${next !== "/boards" ? `?next=${encodeURIComponent(next)}` : ""}`}>
            {isLogin ? "Daftar" : "Masuk"}
          </Link>
        </p>
      </form>
    </div>
  );
}
