# Taskboard

Project board ala Trello/Jira/ClickUp yang **gratis dan self-hosted**: tidak ada batas member, board, atau kartu karena kamu sendiri yang meng-host.

## Fitur

- **Board** dengan 12 pilihan warna/gradient, deskripsi, dan template list (Backlog → To Do → In Progress → Review → Done)
- **Kanban drag & drop**: geser kartu antar list dan urutkan list (di HP: tekan lama untuk drag)
- **Kartu**: tipe Epic / Story / Task / Bug, prioritas, tanggal mulai & deadline, label berwarna, assignee, deskripsi, komentar
- **Storyline**: susun Epic → Story/Task, progress otomatis dari list yang ditandai "selesai", plus timeline (gantt) epic
- **Member tanpa batas**: undang lewat link atau email, role owner / admin / member
- **Filter**: cari judul, filter tipe, "tugas saya"
- **Sinkron antar member** lewat polling tiap 4 detik

## Menjalankan

```bash
npm install
npm run dev -- -p 3100
```

Buka http://localhost:3100, daftar akun, buat board.

Data demo (opsional, saat dev server jalan):

```bash
node scripts/seed-demo.mjs
```

## Deploy (self-host)

```bash
npm run build
DATA_DIR=/var/lib/taskboard COOKIE_SECURE=true npm start -- -p 3100
```

- Data tersimpan di SQLite `DATA_DIR/taskboard.db` (default `./data`). Backup cukup salin file itu.
- Pasang di belakang HTTPS (Caddy/Nginx) dan set `COOKIE_SECURE=true`.
- Bisa di VPS murah, Raspberry Pi, atau Docker. Satu server SQLite cukup untuk ratusan pengguna aktif.

## Struktur

- `src/lib/db.ts` – skema SQLite
- `src/lib/auth.ts` – akun & sesi (cookie httpOnly, bcrypt)
- `src/app/api/**` – REST API JSON
- `src/components/board/*` – Kanban, Storyline, modal kartu, pengaturan
