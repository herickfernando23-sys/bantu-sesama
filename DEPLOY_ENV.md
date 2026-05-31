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
