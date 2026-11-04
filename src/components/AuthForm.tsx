"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "./Logo";

type Provider = { id: string; label: string };

const ERRORS: Record<string, string> = {
  verify: "Link verifikasi tidak valid atau sudah kedaluwarsa. Masuk untuk kirim ulang.",
  oauth: "Gagal masuk lewat GitHub/Google. Coba lagi.",
};

// provider logos as small inline svgs
const ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  ),
};

// field icons (stroke style, 18px)
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const I = {
  user: icon("M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"),
  mail: icon("M4 6h16v12H4zM4 7l8 6 8-6"),
  lock: icon("M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"),
  eye: icon("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"),
  eyeOff: icon("M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"),
};

// labelled input with a leading icon and optional trailing control
function Field({ label, iconEl, trailing, ...props }: { label: string; iconEl: React.ReactNode; trailing?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <span className="group relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-slate-400 group-focus-within:text-blue-600">{iconEl}</span>
        <input
          {...props}
          className="h-11 w-full rounded-xl border border-slate-200 bg-surface pr-11 pl-10 text-[15px] text-slate-900 shadow-sm transition outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
        />
        {trailing && <span className="absolute right-2">{trailing}</span>}
      </span>
    </label>
  );
}

const Spinner = () => <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />;

// left-hand brand panel with a small product preview (desktop only)
function BrandPanel() {
  const cols = [
    { name: "To Do", cards: [{ t: "Riset kompetitor", c: "#f5cd47", w: "w-3/4" }, { t: "Wireframe onboarding", c: "#9f8fef", w: "w-2/3" }] },
    { name: "In Progress", cards: [{ t: "API pembayaran", c: "#579dff", w: "w-4/5" }, { t: "Halaman checkout", c: "#4bce97", w: "w-1/2" }] },
    { name: "Done", cards: [{ t: "Setup database", c: "#4bce97", w: "w-2/3" }] },
  ];
  return (
    <aside className="relative hidden overflow-hidden bg-[#0a2a6b] text-white lg:flex lg:flex-col">
      {/* glow + dot grid background */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,#0059c9_0%,transparent_70%),radial-gradient(50%_45%_at_90%_80%,#0049aa_0%,transparent_70%)] opacity-90" />
      <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative flex flex-1 flex-col p-10 xl:p-14">
        <Logo size={32} tone="dark" className="text-lg" />

        <div className="mt-auto mb-10 max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight xl:text-[2.75rem]">
            Rangkai kerja tim,
            <br />
            <span className="bg-gradient-to-r from-[#7dd3fc] to-[#bfdbfe] bg-clip-text text-transparent">tanpa batas.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#dbeafe]/80">Board, sprint, dan backlog untuk tim mana pun. Undang member sebanyak apa pun, gratis.</p>
        </div>

        {/* mini board preview */}
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="ml-3 text-xs text-[#dbeafe]/70">Sprint 4 · 6 hari lagi · 21/34 poin</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {cols.map((col) => (
              <div key={col.name} className="rounded-xl bg-white/[0.07] p-2.5">
                <div className="mb-2 text-[11px] font-medium tracking-wide text-[#dbeafe]/70 uppercase">{col.name}</div>
                <div className="space-y-2">
                  {col.cards.map((k) => (
                    <div key={k.t} className="rounded-lg bg-surface p-2 text-slate-800 shadow-sm">
                      <span className="mb-1.5 block h-1.5 w-8 rounded-full" style={{ background: k.c }} />
                      <div className="truncate text-[11px] font-medium">{k.t}</div>
                      <div className={`mt-1.5 h-1 rounded-full bg-slate-200 ${k.w}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ul className="mt-8 flex flex-wrap gap-2 text-[13px] text-[#eff6ff]/90">
          {["Member tanpa batas", "Sprint & backlog", "Tim & multi-board", "Import dari Trello"].map((f) => (
            <li key={f} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1">
              <Icon name="check" className="h-3.5 w-3.5" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function AuthForm({ mode, providers }: { mode: "login" | "register"; providers: Provider[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/boards";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(ERRORS[params.get("error") ?? ""] ?? "");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // set once the account needs email confirmation
  const [sentTo, setSentTo] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [note, setNote] = useState("");
  const isLogin = mode === "login";
  const nextQs = next !== "/boards" ? `?next=${encodeURIComponent(next)}` : "";

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
      setNote("Email verifikasi sudah dikirim ulang.");
    } catch (err) {
      setNote((err as Error).message);
    }
  }

  // page frame: brand panel + right column
  const frame = (children: React.ReactNode) => (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <main className="relative flex flex-col bg-[radial-gradient(80%_60%_at_50%_0%,var(--color-blue-50)_0%,var(--color-surface)_60%)] px-5 py-8 sm:px-10">
        <Logo size={34} className="text-lg lg:hidden" />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Tasklace · Gratis untuk semua tim</p>
      </main>
    </div>
  );

  // after registering: tell the user to open their inbox
  if (sentTo)
    return frame(
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-50/50">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Cek email kamu</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
          Link verifikasi sudah dikirim ke <span className="font-medium text-slate-900">{sentTo}</span>. Klik link itu dan kamu langsung masuk.
        </p>
        <p className="mt-2 text-sm text-slate-400">Belum ada? Cek folder spam, atau kirim ulang.</p>
        <button onClick={() => resend(sentTo)} className="mt-6 h-11 w-full rounded-xl border border-slate-200 bg-surface text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          Kirim ulang email
        </button>
        {note && <p className="mt-3 text-sm text-slate-600">{note}</p>}
        <Link href={`/login${nextQs}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          <Icon name="arrow-left" />
          Kembali ke halaman masuk
        </Link>
      </div>,
    );

  return frame(
    <>
      <div className="mb-8">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-slate-900">{isLogin ? "Selamat datang kembali" : "Buat akun Tasklace"}</h1>
        <p className="mt-2 text-[15px] text-slate-500">{isLogin ? "Masuk untuk lanjut ke board tim kamu." : "Gratis selamanya, tanpa batas member."}</p>
      </div>

      {providers.length > 0 && (
        <>
          <div className={`grid gap-3 ${providers.length > 1 ? "grid-cols-2" : ""}`}>
            {providers.map((p) => (
              <a
                key={p.id}
                href={`/api/auth/oauth/${p.id}?next=${encodeURIComponent(next)}`}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-surface text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {ICONS[p.id]} {p.label}
              </a>
            ))}
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> atau dengan email <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        {!isLogin && <Field label="Nama" iconEl={I.user} placeholder="Nama lengkap" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
        <Field label="Email" iconEl={I.mail} type="email" placeholder="nama@perusahaan.com" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Field
          label="Password"
          iconEl={I.lock}
          type={showPw ? "text" : "password"}
          placeholder={isLogin ? "Password kamu" : "Minimal 6 karakter"}
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={isLogin ? 1 : 6}
          trailing={
            <button type="button" onClick={() => setShowPw(!showPw)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}>
              {showPw ? I.eyeOff : I.eye}
            </button>
          }
        />

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
            {unverified && (
              <button type="button" onClick={() => resend(form.email)} className="mt-1 block font-medium text-blue-700 underline-offset-2 hover:underline">
                Kirim ulang email verifikasi
              </button>
            )}
          </div>
        )}
        {note && <p className="text-sm text-slate-600">{note}</p>}

        <button
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-[15px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_8px_20px_-6px_rgba(0,89,201,.5)] transition hover:from-blue-600 hover:to-blue-700 disabled:opacity-70"
        >
          {busy && <Spinner />}
          {busy ? "Memproses…" : isLogin ? "Masuk" : "Buat akun"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
        <Link className="font-semibold text-blue-600 hover:text-blue-700" href={`/${isLogin ? "register" : "login"}${nextQs}`}>
          {isLogin ? "Daftar gratis" : "Masuk"}
        </Link>
      </p>
    </>,
  );
}
