## 📦 Setup Panduan: PostgreSQL + Midtrans

### STEP 1: Setup PostgreSQL Database

#### Option A: PostgreSQL Local (Windows)
```bash
# 1. Install PostgreSQL dari https://www.postgresql.org/download/windows/
# 2. Buka pgAdmin 4 (biasanya terotomatis terinstall)
# 3. Buat database baru:
#    - Klik kanan pada "Databases"
#    - Create → Database
#    - Nama: bantusesama
#    - Owner: postgres
```

#### Option B: PostgreSQL Cloud (Rekomendasi - Gampang)
```bash
# Pakai Supabase (PostgreSQL + Free tier)
# 1. Daftar: https://app.supabase.com/
# 2. Create new project
# 3. Tunggu ~2 menit
# 4. Di sidebar klik "Settings" → "Database"
# 5. Copy connection string yang muncul
# 6. Update DATABASE_URL di .env file
```

**Contoh .env untuk Supabase:**
```
DATABASE_URL=postgresql://postgres:YourPassword@db.xxxxx.supabase.co:5432/postgres
```

---

### STEP 2: Install Dependencies Backend

```bash
cd server
npm install

# Pastikan package.json sudah punya:
# - sequelize
# - pg (PostgreSQL driver)
# - midtrans-client
# - dotenv
```

---

### STEP 3: Setup Database Tables

```bash
# Jalankan dari root folder:
npm run seed:db

# Atau manual via Node:
node -e "require('./server/models').sequelize.sync({ force: false });"
```

---

### STEP 4: Setup Midtrans Sandbox

**Daftar Midtrans:**
1. Buka: https://dashboard.sandbox.midtrans.com/
2. Sign up dengan email
3. Verifikasi email
4. Login ke dashboard

**Dapatkan API Keys:**
1. Klik menu "Settings"
2. Pilih tab "Access Keys"
3. Copy:
   - **Server Key**: `SB-Mid-server-xxxxxxxxxxxxxxx`
   - **Client Key**: `SB-Mid-client-xxxxxxxxxxxxxxx`

**Update .env:**
```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
PAYMENT_DEMO=false
```

---

### STEP 5: Test Koneksi Database

```bash
# Dari folder server:
node -e "
const { sequelize } = require('./models');
sequelize.authenticate()
  .then(() => console.log('✓ Database connected!'))
  .catch(err => console.error('✗ Connection error:', err.message));
"
```

---

### STEP 6: Test Midtrans Integration

```bash
# Dari root folder:
npm run dev:all

# 1. Buka aplikasi di http://localhost:5173
# 2. Buat campaign baru
# 3. Klik "Donasi"
# 4. Pilih nominal & metode pembayaran
# 5. Ikuti flow payment Midtrans

# Di Midtrans Dashboard:
#   - Sandbox → Testing
#   - Lihat semua transaksi yang masuk
```

---

### STEP 7: Test Sandbox Payment (Jangan Real Money!)

**Card Test (Midtrans Sandbox):**
```
Kartu: 4111 1111 1111 1111
Exp: 12/25
CVV: 123
OTP: 123456
```

**E-Wallet Test (Dari Midtrans Dashboard):**
```
Buka: https://app-sandbox.midtrans.com/
Login dengan test account
```

---

### TROUBLESHOOTING

**Error: "connect ECONNREFUSED"**
- PostgreSQL tidak jalan
- Solusi: 
  - Local: Pastikan PostgreSQL service berjalan
  - Cloud: Check DATABASE_URL di .env

**Error: "Midtrans API key invalid"**
- API key copy-paste salah
- Solusi: Double-check di dashboard Midtrans

**Error: "CORS error"**
- CORS_ORIGIN di .env salah
- Update sesuai host frontend (default: http://localhost:5173)

---

### Database Tables (Auto Created)

```
✓ users       - Pendaftar platform
✓ campaigns   - Kampanye penggalang dana
✓ donations   - Transaksi donasi
✓ comments    - Komentar di kampanye
✓ categories  - Kategori kampanye
✓ campaign_categories - Relasi (N:N)
```

---

### Next Steps

Setelah setup selesai:
1. ✅ Update Frontend → Call API backend
2. ✅ Recurring Donation (monthly subscription)
3. ✅ Deploy ke Cloud dengan HTTPS
