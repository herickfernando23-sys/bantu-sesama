# 🎯 VERIFIKASI DONASI RUTIN - Visual Guide

## 🔍 5 Tempat Untuk Cek Donasi Rutin Berhasil

```
┌─────────────────────────────────────────────────────────────────┐
│  1️⃣  API RESPONSE - Saat Setup                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/recurring/setup                                      │
│  ↓                                                              │
│  {                                                              │
│    "success": true,                    ✅ PASS                 │
│    "recurringDonationId": 100,                                  │
│    "transactionToken": "token...",                              │
│    "recurringType": "monthly"                                   │
│  }                                                              │
│                                                                 │
│  STATUS: 200 OK ✅                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────────┐
│  2️⃣  DATABASE - Cek Donation Record                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SELECT * FROM "Donations" WHERE id = 100;                     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ id  │ amount  │ recurring_type │ payment_status │ ...  │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │ 100 │ 100000  │ monthly        │ succeeded      │ ✅   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  REQUIREMENTS:                                                  │
│  ✓ recurring_type = "monthly" atau "yearly"                   │
│  ✓ payment_status = "succeeded"                                │
│  ✓ amount = sesuai donasi                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────────┐
│  3️⃣  CAMPAIGN - Cek Collected Amount                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/campaigns/1                                           │
│  ↓                                                              │
│  {                                                              │
│    "id": 1,                                                     │
│    "title": "Campaign Test",                                    │
│    "goal": 10000000,                                            │
│    "collected": 100000,        ← BERTAMBAH! ✅                  │
│    "progress": 1.0                                              │
│  }                                                              │
│                                                                 │
│  REQUIREMENT:                                                   │
│  ✓ collected amount bertambah sesuai donation amount            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────────┐
│  4️⃣  SCHEDULER - Trigger Automatic Charge                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Update database (simulate 31 hari):                   │
│  UPDATE "Donations"                                            │
│  SET processed_at = NOW() - INTERVAL '31 days'                 │
│  WHERE id = 100;                                               │
│                                                                 │
│  Step 2: Trigger processing:                                   │
│  POST /api/recurring/process-now                               │
│  ↓                                                              │
│  {                                                              │
│    "success": true,                                            │
│    "result": {                                                 │
│      "total": 1,                                               │
│      "processed": 1,        ← Dari 0 jadi 1! ✅                │
│      "succeeded": 1         ← Charge berhasil! ✅              │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  REQUIREMENTS:                                                  │
│  ✓ processed > 0 (berarti ada yang di-process)                 │
│  ✓ succeeded > 0 (berarti berhasil)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────────┐
│  5️⃣  CHARGE HISTORY - Cek Child Donations Tercipta            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SELECT * FROM "Donations"                                     │
│  WHERE campaign_id = 1                                         │
│  ORDER BY created_at DESC;                                     │
│                                                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │ id  │ parent_recurring_id │ recurring_type   │              │
│  ├──────────────────────────────────────────────┤              │
│  │ 101 │               100   │ one-time     ✅  │ ← CHARGE!   │
│  │ 100 │               NULL  │ monthly      ✅  │ ← PARENT    │
│  └──────────────────────────────────────────────┘              │
│                                                                 │
│  REQUIREMENTS:                                                  │
│  ✓ Ada donation baru (id=101) sebagai child                    │
│  ✓ parent_recurring_donation_id = 100                          │
│  ✓ recurring_type = "one-time" (charge individual)             │
│                                                                 │
│  Alternative: GET /api/recurring/details/100                   │
│  Lihat chargeHistory di response                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ DONASI RUTIN BERHASIL ATAU TIDAK?

```
╔═══════════════════════════════════════════════════════════════╗
║                    STATUS CHECKLIST                          ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ✅ API Response 200 + donation ID
║     → Recurring setup berhasil
║                                                               ║
║  ✅ Database: recurring_type & payment_status OK
║     → Data tersimpan dengan benar
║                                                               ║
║  ✅ Campaign collected amount bertambah
║     → Donation terhitung ke campaign
║                                                               ║
║  ✅ Charge triggered (processed > 0, succeeded > 0)
║     → Scheduler berfungsi otomatis
║                                                               ║
║  ✅ Child donation di database (parent_recurring_donation_id)
║     → Charge tracking berfungsi
║                                                               ║
║  ───────────────────────────────────────────────────────────  ║
║                                                               ║
║  🎉 JIKA SEMUA ✅ PASS → DONASI RUTIN BERHASIL!               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🚀 PROSES FLOW DONASI RUTIN

```
USER DONATES
    ↓
    │ POST /api/recurring/setup
    │ ┌─────────────────────────────┐
    └→ │ 1. Create Donation record  │
       │    (recurringType=monthly) │
       │ 2. Generate Midtrans token │
       │ 3. Return token to user    │
       └─────────────────────────────┘
                  ↓
          ✅ CHECK #1: API Response
             (success: true, donation ID ada)
                  ↓
       ┌─────────────────────────────┐
       │ USER PAYS INITIAL CHARGE    │
       │ (Same as one-time payment)  │
       └─────────────────────────────┘
                  ↓
          ✅ CHECK #2: Database
             (payment_status = succeeded)
                  ↓
          ✅ CHECK #3: Campaign
             (collected amount bertambah)
                  ↓
           [WAIT FOR CRON OR TRIGGER]
                  ↓
       ┌─────────────────────────────┐
       │ EVERY MONTH (Automatic)     │
       │ 1. Check 30 days passed?    │
       │ 2. Create child donation    │
       │ 3. Trigger Midtrans charge  │
       │ 4. Update campaign amount   │
       └─────────────────────────────┘
                  ↓
          ✅ CHECK #4: Scheduler
             (processed > 0, succeeded > 0)
                  ↓
          ✅ CHECK #5: Database
             (child donation created,
              parent_recurring_donation_id OK)
```

---

## 🔧 QUICK TEST 1-2-3

```bash
# 1. Setup recurring donation
node scripts/test-recurring.js setup
#
# LIHAT: 
# ✓ status 200?
# ✓ success: true?
# ✓ ada recurringDonationId?
# JIKA SEMUA YES → ✅ PASS

# ---

# 2. Check database
psql -U postgres -d microcrowd
SELECT * FROM "Donations" WHERE id = <donation_id>;
#
# LIHAT:
# ✓ recurring_type = 'monthly'?
# ✓ payment_status = 'succeeded'?
# JIKA SEMUA YES → ✅ PASS

# ---

# 3. Trigger processing
node scripts/test-recurring.js process "admin-key"
#
# LIHAT:
# ✓ processed = 1?
# ✓ succeeded = 1?
# JIKA SEMUA YES → ✅ PASS
```

---

## 🎯 SUMMARY

| Cek Nomor | Tempat | Hasil Sukses |
|-----------|--------|-------------|
| 1 | API Response | status: 200, success: true |
| 2 | Database Donation | recurring_type ≠ one-time |
| 3 | Campaign | collected > 0 |
| 4 | Scheduler | processed > 0 |
| 5 | Child Donation | parent_recurring_donation_id set |

**Jika semua 5 cek ✅ PASS → Donasi Rutin Berhasil 100%** 🎉

---

## 📞 Dokumentasi Lengkap

Untuk detail lebih lanjut, lihat:
- `RECURRING_DONATIONS.md` - API Reference
- `TESTING_RECURRING_DONATIONS.md` - Testing Guide
- `QUICK_REFERENCE_TESTING.md` - Quick Cheatsheet
