# 🚀 Donasi Rutin - Quick Reference Testing

## Verifikasi Donasi Rutin Berhasil: 5 Poin Utama

### ✅ 1. Setup Berhasil?
```bash
# Response harus berisi ini:
{
  "success": true,
  "recurringDonationId": 100,
  "transactionToken": "token_here",
  "recurringType": "monthly"
}
```
**✓ PASS** jika: status 200 + ada donation ID + ada token

---

### ✅ 2. Database Record Tercipta?
```sql
-- Query:
SELECT * FROM "Donations" WHERE id = 100;

-- Expected output:
 id  | amount  | recurring_type | payment_status | processed_at
 100 | 100000  | monthly        | succeeded      | timestamp
```
**✓ PASS** jika: `recurring_type = 'monthly'` + `payment_status = 'succeeded'`

---

### ✅ 3. Campaign Collected Bertambah?
```bash
# Response dari GET /api/campaigns/1 harus:
{
  "collected": 100000,  ← Bertambah!
  "goal": 10000000
}
```
**✓ PASS** jika: collected amount naik sesuai donation

---

### ✅ 4. Charge Otomatis Trigger?
```bash
# Step 1: Update database (simulate 31 hari)
UPDATE "Donations" 
SET processed_at = NOW() - INTERVAL '31 days'
WHERE id = 100;

# Step 2: Trigger processing
curl -X POST http://localhost:4000/api/recurring/process-now \
  -H "x-admin-key: your-admin-key"

# Response harus:
{
  "result": {
    "processed": 1,  ← berubah dari 0!
    "succeeded": 1   ← berhasil!
  }
}
```
**✓ PASS** jika: `processed = 1` dan `succeeded = 1`

---

### ✅ 5. Charge Ditambahkan ke Database?
```sql
-- Query: Lihat semua donations untuk campaign
SELECT id, parent_recurring_donation_id, recurring_type, created_at
FROM "Donations"
WHERE campaign_id = 1
ORDER BY created_at DESC;

-- Expected output:
 id  | parent_recurring_donation_id | recurring_type
 101 |                          100 | one-time     ← CHILD (charge)
 100 |                           \N | monthly      ← PARENT
```
**✓ PASS** jika: ada donation baru dengan `parent_recurring_donation_id = 100`

---

## 🎯 Quick Test Commands

### 1️⃣ Setup Recurring
```bash
node scripts/test-recurring.js setup
```
**Expected:** Muncul recurring donation ID

---

### 2️⃣ List Recurring
```bash
# Dapatkan JWT token dulu dari login
node scripts/test-recurring.js list "YOUR_JWT_TOKEN"
```
**Expected:** List recurring donations yang aktif

---

### 3️⃣ Check Charge History
```bash
node scripts/test-recurring.js details 100 "YOUR_JWT_TOKEN"
```
**Expected:** Detail recurring + riwayat charges

---

### 4️⃣ Trigger Processing Manual
```bash
# Set ADMIN_PROCESS_KEY di .env dulu!
node scripts/test-recurring.js process "your-admin-key"
```
**Expected:** 
- `processed: 1` jika ada yang jatuh tempo
- `succeeded: 1` jika charge berhasil

---

### 5️⃣ Cancel Recurring
```bash
node scripts/test-recurring.js cancel 100 "YOUR_JWT_TOKEN"
```
**Expected:** Success message, recurring dibatalkan

---

## 🔍 Cek Database Langsung

### Quick Database Check

**PostgreSQL:**
```bash
# Masuk ke database
psql -U postgres -d microcrowd

# Query 1: Cek recurring donation
SELECT id, amount, recurring_type, payment_status, processed_at
FROM "Donations"
WHERE recurring_type IN ('monthly', 'yearly')
ORDER BY created_at DESC
LIMIT 10;

# Query 2: Cek charge history untuk donation ID 100
SELECT id, amount, parent_recurring_donation_id, created_at
FROM "Donations"
WHERE parent_recurring_donation_id = 100
ORDER BY created_at DESC;

# Query 3: Cek campaign collected
SELECT id, title, collected, goal
FROM "Campaigns"
WHERE id = 1;

# Query 4: Cek daftar semua donations per campaign
SELECT id, amount, recurring_type, payment_status
FROM "Donations"
WHERE campaign_id = 1
ORDER BY created_at DESC;
```

---

## 📊 Testing Status Checklist

Gunakan checklist ini untuk tracking test:

```
Testing Checklist untuk Recurring Donations
=============================================

□ Setup recurring donation
  └─ Response: status 200, donation ID ada

□ Payment confirmation
  └─ Database: payment_status = 'succeeded'

□ Campaign collected updated
  └─ GET /api/campaigns: collected amount bertambah

□ Trigger charge automatically
  └─ Database: child donation created

□ Verify charge history
  └─ GET /api/recurring/details: chargeHistory ada

□ Cancel recurring
  └─ Database: payment_status = 'refunded'

□ Auto cron job
  └─ Server logs: [Cron] processing messages

Summary: ___/7 tests passed

Date: _______
Tester: _______
Notes:
_________________________________
_________________________________
```

---

## 🐛 Troubleshooting Cepat

| Error | Solusi |
|-------|--------|
| "Unauthorized" | Login dulu, dapatkan JWT token |
| "Campaign not found" | Pastikan campaign ID valid |
| "Invalid admin key" | Set `ADMIN_PROCESS_KEY` di `.env` |
| Charge tidak trigger | Update `processed_at` ke 31 hari lalu |
| Server error | Restart server: `npm start` |

---

## 🚀 Verifikasi Final

Jika semua checklist di atas ✅ PASS:

```
✅ DONASI RUTIN BERHASIL DIIMPLEMENTASIKAN

✓ Setup recurring donation - WORKING
✓ Database tracking - WORKING  
✓ Campaign collection - WORKING
✓ Auto charging scheduler - WORKING
✓ Charge history - WORKING
✓ User management - WORKING

→ Ready untuk Production Deployment! 🎉
```

---

## 📝 Testing Script Usage

```bash
# Masuk ke folder project
cd "C:\Users\heric\Downloads\Micro-Crowdfunding Platform"

# Test 1: Setup
node scripts/test-recurring.js setup

# Test 2: List (ganti TOKEN)
node scripts/test-recurring.js list "your-jwt-token-here"

# Test 3: Details (ganti DONATION_ID dan TOKEN)
node scripts/test-recurring.js details 100 "your-jwt-token-here"

# Test 4: Process (ganti ADMIN_KEY)
node scripts/test-recurring.js process "your-admin-key"

# Test 5: Cancel (ganti DONATION_ID dan TOKEN)
node scripts/test-recurring.js cancel 100 "your-jwt-token-here"

# Help
node scripts/test-recurring.js help
```

---

## 📞 Need Help?

File dokumentasi:
- `RECURRING_DONATIONS.md` - Dokumentasi lengkap API
- `TESTING_RECURRING_DONATIONS.md` - Testing guide detail
- `scripts/test-recurring.js` - Testing script

Server logs:
```bash
# Lihat server logs untuk verify cron job
# Output format:
# [Cron] Starting daily recurring donation processing...
# [RecurringService] Found X recurring donations to check
# [RecurringService] Processing donation ID X (monthly)
```
