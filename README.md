# Rajutin

Project board ala Trello/Jira/ClickUp yang **gratis**: tidak ada batas member, board, atau kartu. Jalan di **Vercel (Hobby)** + **Supabase (Free)**.

## Fitur

- **Board** dengan 12 pilihan warna/gradient, deskripsi, dan template list (Backlog → To Do → In Progress → Review → Done)
- **Kanban drag & drop**: geser kartu antar list dan urutkan list (di HP: tekan lama untuk drag)
- **Kartu / issue**: tipe Epic / Story / Task / Bug, kode issue ala Jira (`RJT-12`, kode bisa diganti di pengaturan board), story points, prioritas, tanggal mulai & deadline, label berwarna, assignee, deskripsi, komentar
- **Sprint & Backlog**: buat sprint, isi dari backlog, mulai sprint (tanggal + sprint goal), selesaikan sprint dan pindahkan issue yang belum beres ke sprint berikutnya atau backlog, riwayat sprint dengan poin yang selesai. Board menampilkan banner sprint aktif (sisa hari, progress poin)
- **List**: semua issue dalam tabel yang bisa diurutkan per kolom
- **Storyline**: susun Epic → Story/Task, progress otomatis dari list yang ditandai "selesai", plus timeline (gantt) epic
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
