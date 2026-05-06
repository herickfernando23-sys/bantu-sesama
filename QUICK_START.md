## 🚀 Quick Start Guide - BantuSesama

### Prerequisites
- Node.js 16+ dan npm/pnpm
- PostgreSQL (local atau cloud Supabase)
- Midtrans Sandbox Account

---

## Phase 1: Database Setup

### Option A: PostgreSQL Local (Windows)

```bash
# 1. Download PostgreSQL
https://www.postgresql.org/download/windows/

# 2. Jalankan installer, default port 5432
# Password untuk postgres user (ingat password ini!)

# 3. Buka pgAdmin 4
# Right-click "Databases" → Create → Database
# Name: bantusesama

# 4. Get connection string
# Format: postgresql://postgres:YOUR_PASSWORD@localhost:5432/bantusesama
```

### Option B: PostgreSQL Cloud (Supabase - Recommended)

```bash
# 1. Daftar di https://app.supabase.com/
# 2. Create new project
# 3. Tunggu ~2 menit
# 4. Go to Settings → Database
# 5. Copy connection string:
#    postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres

# Keuntungan:
# ✓ Gratis tier yang cukup
# ✓ Tidak perlu install lokal
# ✓ Auto backup
# ✓ Mudah deploy ke production
```

---

## Phase 2: Configure Backend

```bash
# 1. Update .env dengan database URL
nano .env   # atau buka dengan text editor

# Ganti:
DATABASE_URL=postgresql://postgres:password@localhost:5432/bantusesama
# Dengan connection string dari database Anda
```

---

## Phase 3: Setup Midtrans Sandbox

```bash
# 1. Daftar di https://dashboard.sandbox.midtrans.com/
# 2. Verifikasi email
# 3. Login ke dashboard
# 4. Menu: Settings → Access Keys
# 5. Copy dan update .env:

MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx...
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx...
MIDTRANS_IS_PRODUCTION=false
```

---

## Phase 4: Install Dependencies & Sync Database

```bash
# Backend
cd server
npm install

# Sync database tables (auto create dari models)
npm run seed:db

# Frontend (from root)
npm install
```

---

## Phase 5: Run Application

### Development Mode (Both Frontend & Backend)
```bash
# Dari root folder
npm run dev:all

# Frontend: http://localhost:5173
# Backend: http://localhost:4000
```

### Separate terminals (alternative)
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
npm run dev
```

---

## Phase 6: Test Payment Flow

### Demo Mode (No Real Money)
```bash
# .env setting:
PAYMENT_DEMO=true

# Test dengan form:
# 1. Buka http://localhost:5173
# 2. Create campaign
# 3. Klik Donasi
# 4. Isi form (nama, email, nominal)
# 5. Selesai - langsung terdebit (demo)
```

### Real Midtrans Sandbox

```bash
# .env setting:
PAYMENT_DEMO=false

# Test card:
Nomor: 4111 1111 1111 1111
Exp: 12/25
CVV: 123
OTP: 123456

# Payment flow:
# 1. Klik Donasi
# 2. Snap popup muncul
# 3. Pilih bank transfer / e-wallet / card
# 4. Ikuti instruksi pembayaran
# 5. Berhasil → donation muncul di campaign
```

### Test E-Wallet (GoPay, OVO)
```bash
# Dari Midtrans dashboard:
# Settings → Testing → Choose Payment Method
# Generate test account untuk sandbox
# Gunakan credentials itu untuk simulasi pembayaran
```

---

## Database Tables Overview

```
users
├─ id (PK)
├─ email
├─ password (hashed)
├─ name
└─ isAdmin

campaigns
├─ id (PK)
├─ title
├─ userId (FK)
├─ collected (amount so far)
├─ target
├─ status (active/completed/rejected)
└─ disbursementHistory (JSON)

donations
├─ id (PK)
├─ campaignId (FK)
├─ userId (FK, null if anonymous)
├─ amount
├─ paymentStatus (pending/processing/succeeded/failed)
├─ paymentMethod (bank_transfer/virtual_account/card/ewallet)
├─ midtransTransactionId
├─ donorName
├─ donorEmail
├─ isAnonymous
└─ message

comments
├─ id (PK)
├─ campaignId (FK)
├─ userId (FK)
├─ text
└─ createdAt

categories
├─ id (PK)
└─ name (kesehatan, pendidikan, dll)

campaign_categories (N:N join table)
├─ campaignId (FK)
└─ categoryId (FK)
```

---

## API Endpoints

### Payments
```
POST /api/payments/create-intent
  Body: { amount, campaignId, donorName, donorEmail, paymentMethod, ... }
  Response: { transactionToken, orderId, donationId, ... }

POST /api/payments/confirm
  Body: { donationId, orderId, transactionId }
  Response: { success, paymentStatus, ... }

GET /api/payments/status/:orderId
  Response: { status, paymentStatus, amount, ... }

POST /api/payments/webhook
  (Midtrans notification endpoint)
```

### Campaigns
```
GET /api/campaigns
GET /api/campaigns/:id
POST /api/campaigns (auth required)
PUT /api/campaigns/:id (auth required)
```

### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

---

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432

Solution:
1. PostgreSQL service tidak jalan
2. DATABASE_URL di .env salah
3. Password PostgreSQL salah
4. Check: psql -U postgres -h localhost (for local)
```

### Midtrans API Key Error
```
Error: "API key invalid" or "Unauthorized"

Solution:
1. Copy-paste API key ulang (hati-hati extra space)
2. Pastikan SB-Mid-server- dan SB-Mid-client- prefix benar
3. Check Midtrans dashboard: Settings → Access Keys
```

### CORS Error
```
Error: CORS policy blocked

Solution:
1. Check CORS_ORIGIN di .env
2. Pastikan sesuai dengan frontend URL
3. Untuk local: http://localhost:5173
4. Untuk production: update sesuai domain
```

### Database Tables Not Created
```
Error: relation "users" does not exist

Solution:
npm run seed:db
# Atau manual:
node -e "require('./server/models').sequelize.sync({ alter: true })"
```

---

## Next Steps

### 1. Recurring Donations (Monthly)
- [ ] Frontend: Add monthly option in payment modal
- [ ] Backend: Implement subscription logic
- [ ] Webhook: Handle subscription events

### 2. Frontend API Integration
- [ ] Replace localStorage with API calls
- [ ] Create API client service module
- [ ] Update campaign CRUD operations

### 3. Admin Features
- [ ] User management dashboard
- [ ] Campaign verification flow
- [ ] Withdrawal request system (partially done)

### 4. Deployment
- [ ] Frontend: Vercel
- [ ] Backend: Railway / Render
- [ ] Database: PostgreSQL cloud (Supabase)
- [ ] Domain & HTTPS setup

---

## Testing Checklist

- [ ] Database connection works
- [ ] Backend server starts without errors
- [ ] Frontend loads at http://localhost:5173
- [ ] Can create campaign
- [ ] Demo payment works (PAYMENT_DEMO=true)
- [ ] Real Midtrans payment works (card 4111...)
- [ ] E-wallet payment works (GoPay/OVO)
- [ ] Donation appears in campaign after payment
- [ ] Admin login works (admin/bantu2024)
- [ ] Withdrawal requests can be created
- [ ] Withdrawal status updates work

---

## Environment Variables Recap

```env
# REQUIRED
DATABASE_URL=postgresql://...
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...

# RECOMMENDED
MIDTRANS_IS_PRODUCTION=false
PAYMENT_DEMO=false
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# OPTIONAL
PORT=4000
OPENAI_API_KEY=sk-...
TRUST_PROXY=0
```

---

## Need Help?

1. Check DATABASE_MIDTRANS_SETUP.md for detailed steps
2. Review .env template for all configurations
3. Check server logs: `npm run dev` shows all errors
4. Test API endpoints: `curl http://localhost:4000/health`

Good luck! 🎉
