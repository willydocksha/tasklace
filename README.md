# Rajutin

Project board ala Trello/Jira/ClickUp yang **gratis**: tidak ada batas member, board, atau kartu. Jalan di **Vercel (Hobby)** + **Supabase (Free)**.

## Fitur

- **Board** dengan 12 pilihan warna/gradient, deskripsi, dan template list (Backlog → To Do → In Progress → Review → Done)
- **Kanban drag & drop**: geser kartu antar list dan urutkan list (di HP: tekan lama untuk drag)
- **Kartu / issue**: tipe Epic / Story / Task / Bug, kode issue ala Jira (`RJT-12`, kode bisa diganti di pengaturan board), story points, prioritas, tanggal mulai & deadline, label berwarna, assignee, deskripsi, komentar
- **Sprint & Backlog**: buat sprint, isi dari backlog, mulai sprint (tanggal + sprint goal), selesaikan sprint dan pindahkan issue yang belum beres ke sprint berikutnya atau backlog, riwayat sprint dengan poin yang selesai. Board menampilkan banner sprint aktif (sisa hari, progress poin)
- **List**: semua issue dalam tabel yang bisa diurutkan per kolom
- **Storyline**: susun Epic → Story/Task, progress otomatis dari list yang ditandai "selesai", plus timeline (gantt) epic
- **Tim**: kelompokkan orang dan board. Satu board boleh masuk ke beberapa tim (Tim 1: A, B, C; Tim 2: B, C, D), semua member tim bisa membukanya, dan orang tetap bisa diundang langsung ke board. Admin/owner tim otomatis jadi admin board-nya
- **Import dari Trello**: upload file JSON export board Trello; list, kartu, label, checklist, lampiran (link) dan komentar ikut pindah
- **Akun**: daftar dengan email + verifikasi (klik link di email langsung masuk), atau masuk lewat GitHub / Google
- **Member tanpa batas**: undang lewat link atau email, role owner / admin / member. Login memakai akun Rajutin sendiri (bukan Supabase Auth), jadi tidak kena batas MAU Supabase.
- **Filter**: cari judul atau kode issue, filter tipe, sprint, "tugas saya"
- **Sinkron real-time** antar member lewat Supabase Realtime (fallback polling kalau belum diatur)

## Setup Supabase (sekali)

1. Buat project gratis di https://supabase.com (region terdekat, misalnya Singapore). Simpan password database-nya.
2. **Project Settings → Database → Connection string → Transaction pooler** (port `6543`). Salin URL-nya, ganti `[YOUR-PASSWORD]`.
3. **Project Settings → API**: salin `Project URL` dan `anon public` key.
4. Salin `.env.example` jadi `.env.local`, isi ketiga nilai di atas.
5. Buat tabel:

   ```bash
   npm run db:migrate
   ```

   (Atau tempel isi `db/schema.sql` di Supabase → SQL Editor → Run.)

Semua tabel memakai Row Level Security tanpa policy, jadi tidak bisa dibaca lewat anon key. Anon key hanya dipakai untuk channel Realtime yang mengirim sinyal "board berubah", tanpa isi data.

## Email verifikasi (opsional)

Isi `SMTP_*` di `.env.local` dan di Vercel (lihat `.env.example`). Paling gampang pakai Gmail:

1. Buat akun Gmail khusus, misalnya `rajutin.app@gmail.com`, aktifkan **2-Step Verification**.
2. Buka https://myaccount.google.com/apppasswords, buat App Password, isi ke `SMTP_PASS`.
3. Batas kirim Gmail sekitar 500 email/hari.

Tanpa `SMTP_HOST`, production langsung mengaktifkan akun tanpa verifikasi, sedangkan di lokal link verifikasi dicetak di log server.

## Login GitHub / Google (opsional)

- **GitHub**: https://github.com/settings/developers → *New OAuth App*. Homepage: URL aplikasi. Callback: `https://<domain>/api/auth/oauth/github/callback`. Isi `GITHUB_CLIENT_ID` dan `GITHUB_CLIENT_SECRET`.
- **Google**: https://console.cloud.google.com → *APIs & Services* → *OAuth consent screen* (External), lalu *Credentials* → *OAuth client ID* (Web). Redirect URI: `https://<domain>/api/auth/oauth/google/callback`. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.

Tombolnya muncul otomatis di halaman masuk/daftar begitu kredensialnya diisi. Untuk dev lokal, tambahkan juga callback `http://localhost:3100/...` di masing-masing app.

## Menjalankan lokal

```bash
npm install
npm run dev -- -p 3100
```

Buka http://localhost:3100, daftar akun, buat board. Data demo (opsional, saat dev server jalan):

```bash
node scripts/seed-demo.mjs
```

## Deploy ke Vercel

1. Push repo ini ke GitHub, lalu **Import Project** di https://vercel.com.
2. Di **Environment Variables** isi `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sama dengan `.env.local`).
3. Deploy. Cookie otomatis `secure` di Vercel. Fungsi server dijalankan di Dublin (`vercel.json`) supaya dekat dengan database Supabase di eu-west-1; ganti kalau region Supabase-mu berbeda.

Catatan batas gratis:

- Supabase Free: database 500 MB, project **di-pause kalau 7 hari tidak ada aktivitas** (bisa di-resume dari dashboard).
- Vercel Hobby: untuk pemakaian non-komersial. Kalau dipakai untuk bisnis, perlu plan Pro atau pindah host.

## Struktur

- `db/schema.sql` – skema Postgres (`npm run db:migrate`)
- `src/lib/db.ts` – koneksi Postgres (postgres.js, lewat pooler Supabase)
- `src/lib/auth.ts` – akun & sesi (cookie httpOnly, bcrypt)
- `src/lib/realtime.ts` – sinyal perubahan board lewat Supabase Realtime
- `src/app/api/**` – REST API JSON
- `src/components/board/*` – Kanban, Storyline, modal kartu, pengaturan
