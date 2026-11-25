# Tasklace

Project board ala Trello/Jira/ClickUp yang **gratis**: tidak ada batas member, board, atau kartu. Jalan di **Vercel (Hobby)** + **Supabase (Free)**.

## Fitur

- **Board** dengan 12 pilihan warna/gradient, deskripsi, dan template list (Backlog → To Do → In Progress → Review → Done)
- **Kanban drag & drop**: geser kartu antar list dan urutkan list (di HP: tekan lama untuk drag)
- **Kartu / issue**: tipe Epic / Story / Task / Bug, kode issue ala Jira (`TLC-12`, kode bisa diganti di pengaturan board), story points, prioritas, tanggal mulai & deadline, label berwarna, assignee, deskripsi, komentar
- **Sprint & Backlog**: buat sprint, isi dari backlog, mulai sprint (tanggal + sprint goal), selesaikan sprint dan pindahkan issue yang belum beres ke sprint berikutnya atau backlog, riwayat sprint dengan poin yang selesai. Board menampilkan banner sprint aktif (sisa hari, progress poin)
- **List**: semua issue dalam tabel yang bisa diurutkan per kolom
- **Storyline**: susun Epic → Story/Task, progress otomatis dari list yang ditandai "selesai", plus timeline (gantt) epic
- **Tim**: kelompokkan orang dan board. Satu board boleh masuk ke beberapa tim (Tim 1: A, B, C; Tim 2: B, C, D), semua member tim bisa membukanya, dan orang tetap bisa diundang langsung ke board. Admin/owner tim otomatis jadi admin board-nya
- **Import dari Trello**: upload file JSON export board Trello; list, kartu, label, checklist, lampiran (link) dan komentar ikut pindah
- **Akun**: daftar dengan email + verifikasi (klik link di email langsung masuk), atau masuk lewat GitHub / Google
- **Member tanpa batas**: undang lewat link atau email, role owner / admin / member. Login memakai akun Tasklace sendiri (bukan Supabase Auth), jadi tidak kena batas MAU Supabase.
- **Filter**: cari judul atau kode issue, filter tipe, sprint, "tugas saya"
- **Sinkron real-time** antar member lewat Supabase Realtime (fallback polling kalau belum diatur)

## Teknologi

| Bagian | Teknologi | Dipakai untuk | Kenapa |
|---|---|---|---|
| Framework | **Next.js 15** (App Router) + **React 19** + **TypeScript** | Halaman sekaligus REST API (`src/app/api/**`) dalam satu project | Frontend dan backend di satu repo, langsung jalan di Vercel tanpa server terpisah |
| Styling | **Tailwind CSS v4** | Semua tampilan, tema warna board, dark mode | Cepat untuk UI yang banyak variasi warna, tanpa file CSS per komponen |
| Database | **PostgreSQL di Supabase** + **postgres.js** | Semua data: board, list, kartu, sprint, tim, user | Supabase Free cukup besar untuk tim kecil. postgres.js ringan dan aman dipakai lewat transaction pooler (port 6543) di serverless |
| Real-time | **@supabase/realtime-js** | Sinyal "board X berubah" ke semua tab yang membuka board itu | Hanya mengirim sinyal tanpa isi data. Client lalu mengambil ulang data lewat API, jadi semua pengecekan hak akses tetap di server |
| Penyimpanan gambar | **Supabase Storage** (bucket privat) | Avatar, gambar di deskripsi/komentar, lampiran | Supaya database 500 MB tidak cepat penuh. Tanpa service role key, gambar disimpan di kolom `bytea` (praktis untuk dev lokal) |
| Auth | Buatan sendiri: **bcryptjs** + cookie httpOnly, OAuth 2 GitHub/Google | Daftar, masuk, sesi, login sosial | Tidak memakai Supabase Auth, jadi tidak kena batas MAU dan user bebas ditambah |
| Email | **nodemailer** (SMTP, misalnya Gmail) | Link verifikasi akun dan undangan | Gratis lewat App Password Gmail, tanpa layanan email berbayar |
| Drag & drop | **@dnd-kit** (core, sortable) | Geser kartu dan list di Kanban, termasuk tekan lama di HP | Mendukung sentuh dan keyboard, lebih ringan dari library DnD lama |
| Editor teks | **TipTap v3** (+ markdown, image, code block **lowlight**) | Deskripsi kartu dan komentar dengan format, gambar, dan blok kode | Editor WYSIWYG yang bisa disimpan sebagai Markdown |
| Lain-lain | **@floating-ui** (posisi popover/menu), **gemoji** (shortcode emoji `:smile:`), **prettier** + **sql-formatter** (merapikan blok kode di editor) | | |
| Hosting | **Vercel Hobby** | Halaman dan API route sebagai fungsi serverless | Gratis, deploy otomatis dari GitHub |

### Alur data

```
Browser (React)
   │  fetch JSON
   ▼
Next.js API route (src/app/api/**)  ── cek sesi + hak akses (src/lib/auth.ts, permissions.ts)
   │  postgres.js lewat Supabase pooler
   ▼
PostgreSQL (Supabase)          gambar → Supabase Storage
   │
   └─ setelah data berubah: kirim sinyal "board berubah" lewat Supabase Realtime
         → tab lain menerima sinyal → fetch ulang data board
```

Tabel memakai Row Level Security tanpa policy, jadi yang bisa membaca data hanya server (lewat `DATABASE_URL`), bukan browser.

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

1. Buat akun Gmail khusus, misalnya `tasklace.app@gmail.com`, aktifkan **2-Step Verification**.
2. Buka https://myaccount.google.com/apppasswords, buat App Password, isi ke `SMTP_PASS`.
3. Batas kirim Gmail sekitar 500 email/hari.

Tanpa `SMTP_HOST`, production langsung mengaktifkan akun tanpa verifikasi, sedangkan di lokal link verifikasi dicetak di log server.

## Login GitHub / Google (opsional)

- **GitHub**: https://github.com/settings/developers → *New OAuth App*. Homepage: URL aplikasi. Callback: `https://<domain>/api/auth/oauth/github/callback`. Isi `GITHUB_CLIENT_ID` dan `GITHUB_CLIENT_SECRET`.
- **Google**: https://console.cloud.google.com → *APIs & Services* → *OAuth consent screen* (External), lalu *Credentials* → *OAuth client ID* (Web). Redirect URI: `https://<domain>/api/auth/oauth/google/callback`. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.

Tombolnya muncul otomatis di halaman masuk/daftar begitu kredensialnya diisi. Untuk dev lokal, tambahkan juga callback `http://localhost:3100/...` di masing-masing app.

## Pasang AI lewat MCP

Tasklace punya server MCP di `/api/mcp` (HTTP, tanpa dependensi tambahan). AI yang terhubung bekerja atas nama pemilik token dan memakai handler API yang sama dengan aplikasi, jadi izin board, alur status, kartu Done yang terkunci, dan riwayat aktivitas tetap berlaku.

1. Masuk ke Tasklace → **Profil → Token API & MCP** → **Buat token**. Salin token (`tlc_...`), hanya tampil sekali.
2. Pasang di klien AI:

   ```bash
   claude mcp add --transport http tasklace https://<domain>/api/mcp --header "Authorization: Bearer tlc_xxx"
   ```

   Klien lain (Cursor, dll.) cukup file konfigurasi MCP:

   ```json
   { "mcpServers": { "tasklace": { "type": "http", "url": "https://<domain>/api/mcp", "headers": { "Authorization": "Bearer tlc_xxx" } } } }
   ```

Tool yang tersedia: `list_boards`, `get_board`, `get_card`, `create_card`, `update_card` (termasuk pindah status), `add_comment`. Kartu bisa dirujuk lewat id atau kode issue seperti `TLC-12`. Tidak ada tool hapus, jadi AI tidak bisa menghapus kartu atau board.

Token disimpan sebagai hash SHA-256 (tabel `api_tokens`), bisa dihapus kapan saja dari halaman profil, dan hanya berlaku di `/api/mcp`, bukan di API biasa. Jalankan `npm run db:migrate` sekali untuk membuat tabelnya (build production melakukannya otomatis).

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
2. Di **Environment Variables** isi `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sama dengan `.env.local`). Tambahkan juga sesuai fitur yang dipakai (lihat `.env.example`):
   - `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`: simpan gambar di Supabase Storage
   - `SMTP_*`, `MAIL_FROM`, `APP_URL`: email verifikasi
   - `GITHUB_*`, `GOOGLE_*`: login GitHub / Google
   - `PRESENCE_ENABLED`: status online member
3. Deploy. `npm run build` otomatis menjalankan migrasi database dulu (`scripts/migrate.mjs --deploy`). Cookie otomatis `secure` di Vercel. Fungsi server dijalankan di Dublin (`vercel.json`) supaya dekat dengan database Supabase di eu-west-1; ganti kalau region Supabase-mu berbeda.

Catatan batas gratis:

- Supabase Free: database 500 MB, project **di-pause kalau 7 hari tidak ada aktivitas** (bisa di-resume dari dashboard).
- Vercel Hobby: untuk pemakaian non-komersial. Kalau dipakai untuk bisnis, perlu plan Pro atau pindah host.

## Struktur

- `db/schema.sql` – skema Postgres (`npm run db:migrate`)
- `src/lib/db.ts` – koneksi Postgres (postgres.js, lewat pooler Supabase)
- `src/lib/auth.ts` – akun & sesi (cookie httpOnly, bcrypt)
- `src/lib/realtime.ts` – sinyal perubahan board lewat Supabase Realtime
- `src/lib/oauth.ts` – login GitHub / Google
- `src/lib/tokens.ts` – token pribadi untuk MCP
- `src/app/api/mcp/route.ts` – server MCP (tool memanggil handler API yang ada)
- `src/lib/permissions.ts` – aturan siapa boleh apa di board (dipakai server dan browser)
- `src/lib/storage.ts` – upload gambar ke Supabase Storage (fallback ke kolom `bytea`)
- `src/lib/mail.ts`, `src/lib/verify.ts` – kirim email dan verifikasi akun
- `src/lib/trello.ts` – import JSON export Trello
- `src/app/api/**` – REST API JSON
- `src/components/board/*` – Kanban, Storyline, Backlog, modal kartu, pengaturan
- `scripts/` – migrasi (`migrate.mjs`), data demo (`seed-demo.mjs`), pindah gambar dari database ke Storage (`npm run images:move`)
