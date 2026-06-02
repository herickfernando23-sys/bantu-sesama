# Deploy / Environment Guide

Panduan singkat untuk menyiapkan environment di Vercel (Production, Pre-production, lokal).

## Tujuan
- Pre-production: lingkungan untuk review dan pengujian sebelum promosi ke production.

## Rekomendasi nama branch
- `main` -> Production (sudah terpasang)
- Buat branch `staging` atau `preprod` -> gunakan untuk Pre-production

## Membuat Pre-production Environment di Vercel
1. Buka Project di Vercel → Settings → Environments.
2. Klik **Create Environment**.
3. Isi:
   - Name: `Pre-production` (atau `Staging`)
   - Branch Tracking: pilih branch `staging` atau `preprod` (setiap merge ke branch itu akan bikin deployment)
   - Centang opsi `Automatically assign a domain to the newest deployment` jika mau domain otomatis
4. Save.

## Menyalin Environment Variables dari Production ke Pre-production
1. Di Vercel → Settings → Environment Variables.
2. Untuk setiap variabel di Production yang relevan, klik **Attach current environment variables from another environment** atau tambahkan manual:
   - `VITE_API_URL` = https://your-backend-preprod.example.com  (pastikan backend preprod tersedia)
   - `VITE_SUPABASE_URL` = https://xxxx.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = <anon-key>
   - `VITE_MIDTRANS_CLIENT_KEY` = Mid-client-...  (set sebagai Sensitive)
3. Gunakan nilai yang sesuai untuk pre-production (jangan pakai production API keys unless intended).
4. Save dan redeploy branch `staging` / `preprod`.

## Catatan penting
- Tandai kunci sensitif sebagai **Sensitive** di Vercel. Jangan commit keys ke repo.
- `VITE_API_URL` harus menunjuk ke backend publik yang dapat diakses oleh frontend build/deployment.
- Jika frontend dan backend berada di domain yang sama (monorepo dan functions), `VITE_API_URL` bisa diarahkan ke origin frontend, mis: `https://bantu-sesama-preprod.vercel.app` dan backend route berada di `/api`.

## Local development
Tambahkan file `.env.local` di root proyek (tidak di-commit):
```
VITE_API_URL=http://localhost:4000
VITE_MIDTRANS_CLIENT_KEY=Mid-client-...
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=anon-...
```

Restart dev server setelah mengubah env.

## Verifikasi setelah deploy
- Buka URL Pre-production.
- Buka DevTools → Console → cari:
  - `[PaymentModal] Env vars loaded:` → memastikan `apiBaseUrl` menunjukkan `VITE_API_URL` yang benar.
  - Tidak ada error `VITE_API_URL belum diset`.
  - Snap JS tidak lagi memperingatkan `data-client-key` kosong.

## Jika ingin, saya bisa:
- Menyusun skrip checklist deploy (PR template) atau membuat `vercel.json` contoh.

## Deploy backend (recommended: Render)
Jika kamu ingin backend berjalan sebagai server (dengan cron job dan proses persistent), saya rekomendasikan menggunakan Render, Railway, atau Fly — bukan Vercel serverless. Repo sudah menyertakan `server/Dockerfile` dan `render.yaml` untuk mempermudah deploy ke Render.

Langkah cepat (Render):
1. Daftar/login ke https://render.com dan hubungkan repository GitHub.
2. Pilih "New" → "Web Service" → pilih repo ini dan pilih `render.yaml` (Render akan membaca file tersebut).
3. Atur environment variables di dashboard Render (atau edit di `render.yaml` jika ingin otomatis). Minimal yang perlu di-set di Render:
   - `DATABASE_URL` = postgresql://postgres:... (Supabase connection string)
   - `DATABASE_SSL` = true
   - `CORS_ORIGIN` = https://bantu-sesama-brown.vercel.app (atau domain frontend kamu)
   - `JWT_SECRET` = change_me
   - `MIDTRANS_SERVER_KEY` = Mid-server-...
   - `MIDTRANS_CLIENT_KEY` = Mid-client-...
   - `MIDTRANS_IS_PRODUCTION` = false
   - `DB_SYNC` = false (production: false; only true if you want automatic sequelize sync)
4. Deploy; Render akan build dan menjalankan `server` (port 4000). `render.yaml` terkonfigurasi untuk plan free.

Verifikasi:
- Cek `https://<your-render-service>.onrender.com/health` → harus mengembalikan `{status:"ok"}`.
- Pastikan front-end `VITE_API_URL` di Vercel mengarah ke `https://<your-render-service>.onrender.com`.

Alternatif cepat: Railway atau Fly juga mendukung Docker/Node; langkahnya mirip: hubungkan repo, set root `server`, set env vars, deploy.

Jika mau, saya bisa bantu menyiapkan file env example (`server/.env.example`) berisi daftar variabel yang harus diisi — mau saya buat sekarang?
