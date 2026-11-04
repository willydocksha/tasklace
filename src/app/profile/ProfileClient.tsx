"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PhotoCropper } from "@/components/PhotoCropper";
import { TopBar } from "@/components/TopBar";
import { api } from "@/lib/client";
import type { User } from "@/lib/auth";

const INPUT =
  "h-10 w-full rounded-lg border border-slate-200 bg-surface px-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-3 focus:ring-blue-100 disabled:opacity-60";
const PRIMARY = "h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 dark:hover:bg-blue-500";
const GHOST = "h-9 rounded-lg border border-slate-200 bg-surface px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60";
const PROVIDER_LABEL: Record<string, string> = { github: "GitHub", google: "Google" };

type Note = { ok: boolean; text: string } | null;

// one settings card: title, hint, body
function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// label above a control
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

// green / red feedback line
const Feedback = ({ note }: { note: Note }) =>
  note && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${note.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{note.text}</p>;

export function ProfileClient({ user: initial, hasPassword: hadPassword, providers, pendingEmail, emailResult, instantEmail }: {
  user: User;
  hasPassword: boolean;
  providers: string[];
  pendingEmail: string | null;
  emailResult: "changed" | "invalid" | null;
  instantEmail: boolean;
}) {
  const [user, setUser] = useState(initial);
  const [hasPassword, setHasPassword] = useState(hadPassword);

  // photo
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState<Note>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  // name + username
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? "");
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoNote, setInfoNote] = useState<Note>(null);

  // email
  const [email, setEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<Note>(
    emailResult === "changed" ? { ok: true, text: "Email berhasil diganti." } : emailResult === "invalid" ? { ok: false, text: "Link konfirmasi tidak valid, kedaluwarsa, atau email sudah dipakai akun lain." } : null,
  );
  const [pending, setPending] = useState(pendingEmail);

  // password
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<Note>(null);

  const infoDirty = name.trim() !== user.name || username.trim().replace(/^@/, "").toLowerCase() !== (user.username ?? "");

  // open the crop editor for the picked file
  function pickPhoto(file: File) {
    setPhotoNote(null);
    setCropFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  // upload the cropped square from the editor
  async function uploadPhoto(blob: Blob) {
    setPhotoBusy(true);
    setPhotoNote(null);
    try {
      const res = await fetch("/api/profile/avatar", { method: "PUT", headers: { "content-type": blob.type }, body: blob });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengunggah foto");
      setUser((u) => ({ ...u, avatar: json.avatar }));
      setPhotoNote({ ok: true, text: "Foto profil diperbarui." });
    } catch (e) {
      setPhotoNote({ ok: false, text: (e as Error).message });
    } finally {
      setPhotoBusy(false);
      setCropFile(null);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await api("/api/profile/avatar", "DELETE");
      setUser((u) => ({ ...u, avatar: null }));
      setPhotoNote({ ok: true, text: "Foto profil dihapus." });
    } catch (e) {
      setPhotoNote({ ok: false, text: (e as Error).message });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoBusy(true);
    setInfoNote(null);
    try {
      const r = await api<{ name: string; username: string | null }>("/api/profile", "PATCH", { name, username });
      setUser((u) => ({ ...u, ...r }));
      setName(r.name);
      setUsername(r.username ?? "");
      setInfoNote({ ok: true, text: "Profil disimpan." });
    } catch (e) {
      setInfoNote({ ok: false, text: (e as Error).message });
    } finally {
      setInfoBusy(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailNote(null);
    try {
      const r = await api<{ changed?: boolean; sent?: boolean; email: string }>("/api/profile/email", "POST", { email, password: emailPw });
      if (r.changed) {
        setUser((u) => ({ ...u, email: r.email }));
        setEmailNote({ ok: true, text: "Email berhasil diganti." });
      } else {
        setPending(r.email);
        setEmailNote({ ok: true, text: `Link konfirmasi dikirim ke ${r.email}. Email baru aktif setelah link itu diklik.` });
      }
      setEmail("");
      setEmailPw("");
    } catch (e) {
      setEmailNote({ ok: false, text: (e as Error).message });
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setPwNote({ ok: false, text: "Konfirmasi password tidak sama" });
    setPwBusy(true);
    setPwNote(null);
    try {
      await api("/api/profile/password", "POST", { current: pw.current, password: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      setPwNote({ ok: true, text: hasPassword ? "Password diganti. Perangkat lain sudah dikeluarkan." : "Password dibuat. Sekarang kamu juga bisa masuk pakai email." });
      setHasPassword(true);
    } catch (e) {
      setPwNote({ ok: false, text: (e as Error).message });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar user={user} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <div>
          <Link href="/boards" className="text-sm text-slate-500 hover:text-slate-800">
            ← Kembali ke board
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Profil</h1>
          <p className="text-sm text-slate-500">Atur nama, foto, email dan password akun kamu.</p>
        </div>

        {/* photo */}
        <Section title="Foto profil" hint="JPG, PNG atau WebP. Bisa dipotong, digeser dan di-zoom sebelum disimpan.">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <Avatar name={user.name} color={user.color} src={user.avatar} size={84} />
              {photoBusy && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white">…</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={photoBusy} className={PRIMARY}>
                {user.avatar ? "Ganti foto" : "Unggah foto"}
              </button>
              {user.avatar && (
                <button onClick={removePhoto} disabled={photoBusy} className={GHOST}>
                  Hapus foto
                </button>
              )}
            </div>
          </div>
          <Feedback note={photoNote} />
          {cropFile && <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={uploadPhoto} />}
        </Section>

        {/* name + username */}
        <Section title="Info dasar">
          <form onSubmit={saveInfo} className="space-y-4">
            <Field label="Nama">
              <input className={INPUT} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Username" hint="3-30 karakter: huruf kecil, angka, titik atau garis bawah.">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">@</span>
                <input className={`${INPUT} pl-7`} value={username} maxLength={31} placeholder="username" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} />
              </div>
            </Field>
            <button disabled={!infoDirty || infoBusy || !name.trim()} className={PRIMARY}>
              {infoBusy ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
          <Feedback note={infoNote} />
        </Section>

        {/* email */}
        <Section
          title="Email"
          hint={
            <>
              Sekarang: <b className="font-medium text-slate-700">{user.email}</b>
              {!instantEmail && " · email baru harus dikonfirmasi lewat link"}
            </>
          }
        >
          {pending && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Menunggu konfirmasi untuk <b>{pending}</b>. Cek inbox (atau spam) email itu.
            </p>
          )}
          <form onSubmit={changeEmail} className="space-y-4">
            <Field label="Email baru">
              <input className={INPUT} type="email" required value={email} placeholder="nama@contoh.com" onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {hasPassword && (
              <Field label="Password sekarang" hint="Untuk memastikan ini memang kamu.">
                <input className={INPUT} type="password" required value={emailPw} autoComplete="current-password" onChange={(e) => setEmailPw(e.target.value)} />
              </Field>
            )}
            <button disabled={emailBusy || !email} className={PRIMARY}>
              {emailBusy ? "Memproses…" : instantEmail ? "Ganti email" : "Kirim link konfirmasi"}
            </button>
          </form>
          <Feedback note={emailNote} />
        </Section>

        {/* password */}
        <Section
          title={hasPassword ? "Ganti password" : "Buat password"}
          hint={hasPassword ? "Setelah diganti, perangkat lain otomatis keluar." : "Akun kamu masuk lewat GitHub/Google. Buat password supaya bisa juga masuk pakai email."}
        >
          <form onSubmit={changePassword} className="space-y-4">
            {hasPassword && (
              <Field label="Password lama">
                <input className={INPUT} type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password baru" hint="Minimal 6 karakter.">
                <input className={INPUT} type="password" required minLength={6} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Field label="Ulangi password baru">
                <input className={INPUT} type="password" required minLength={6} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
            </div>
            <button disabled={pwBusy} className={PRIMARY}>
              {pwBusy ? "Menyimpan…" : hasPassword ? "Ganti password" : "Buat password"}
            </button>
          </form>
          <Feedback note={pwNote} />
        </Section>

        {/* linked sign-in providers */}
        {providers.length > 0 && (
          <Section title="Akun terhubung">
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {PROVIDER_LABEL[p] ?? p}
                </span>
              ))}
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}
