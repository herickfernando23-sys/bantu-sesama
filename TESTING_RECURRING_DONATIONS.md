# Testing Guide: Donasi Rutin (Recurring Donations)

Panduan lengkap untuk test dan verify donasi rutin berhasil atau tidak.

---

## 📋 Checklist Testing

### ✅ Setup Verification
- [ ] Recurring donation created di database
- [ ] Transaction token generated dari Midtrans
- [ ] Parent donation ID tercatat dengan benar

### ✅ Payment Verification
- [ ] Initial payment sukses
- [ ] Donation status berubah menjadi 'succeeded'
- [ ] Campaign collected amount bertambah

### ✅ Scheduler Verification
- [ ] Cron job berjalan tepat waktu
- [ ] Child donations created otomatis
- [ ] Charge otomatis triggered

### ✅ User Management Verification
- [ ] User bisa list recurring donationnya
- [ ] User bisa lihat charge history
- [ ] User bisa cancel recurring donation
- [ ] User bisa update amount/frequency

---

## 🔧 Test Scenario 1: Setup & Initial Payment

### Step 1: Create Campaign (jika belum ada)
```bash
# Buat campaign untuk test
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Recurring Campaign",
    "description": "Campaign untuk test recurring donations",
    "goal": 10000000,
    "location": "Jakarta",
    "category": "UMKM Terdampak Bencana",
    "fullDescription": "Campaign ini hanya untuk testing recurring donations"
  }'
```

**Save campaign ID dari response** (misal: `campaignId = 1`)

### Step 2: Setup Recurring Donation

**Script Node.js:**
```bash
node -e "
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/recurring/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: 1,  // Ganti dengan campaign ID
        amount: 100000,
        recurringType: 'monthly',
        donorName: 'Test Donor',
        donorEmail: 'testdonor@example.com',
        paymentMethod: 'bank_transfer',
        message: 'Test recurring monthly donation'
      })
    });
    const data = await res.json();
    console.log('SETUP RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\\n✅ SAVE INFO INI:');
    console.log('  Recurring Donation ID:', data.recurringDonationId);
    console.log('  Order ID:', data.orderId);
    console.log('  Amount:', data.amount);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "recurringDonationId": 100,
  "transactionToken": "48fdbf36-6df9-47fe-bf68-77f8a356f9e2",
  "orderId": "RECURRING-INIT-100",
  "amount": 100000,
  "recurringType": "monthly",
  "campaignTitle": "Test Recurring Campaign",
  "message": "Pengaturan donasi rutin monthly berhasil..."
}
```

✅ **Test Passed Jika:**
- Status: 200
- `success: true`
- Ada `recurringDonationId` dan `transactionToken`

---

## 🔧 Test Scenario 2: Verify Database

### Check Database Donation Record

**PostgreSQL Query:**
```sql
-- Connect ke database terlebih dahulu
psql -U postgres -d microcrowd

-- Query: Lihat recurring donation yang baru dibuat
SELECT 
  id, 
  campaign_id, 
  user_id, 
  amount, 
  payment_status, 
  recurring_type, 
  donor_name, 
  payment_method,
  processed_at,
  created_at
FROM "Donations"
WHERE id = 100  -- Ganti dengan recurring donation ID
ORDER BY created_at DESC;
```

**Expected Output:**
```
 id  | campaign_id | user_id | amount  | payment_status | recurring_type | donor_name   | payment_method   | processed_at | created_at
-----+-------------+---------+---------+----------------+----------------+--------------+------------------+--+--
 100 |             1 |       1 | 100000 | pending        | monthly        | Test Donor   | bank_transfer    | 2024-05-10 10:30:00 | 2024-05-10 10:30:00
(1 row)
```

✅ **Test Passed Jika:**
- `recurring_type = 'monthly'` ✅
- `payment_status = 'pending'` (sebelum payment) ✅
- `amount = 100000` ✅

---

## 🔧 Test Scenario 3: Simulate Payment Confirmation

### Confirm Payment (Demo Mode)

Untuk demo/testing, kita bisa confirm payment ke `/api/payments/confirm`:

```bash
node -e "
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: 'RECURRING-INIT-100',
        donationId: 100,
        orderId: 'RECURRING-INIT-100',
        transactionStatus: 'settlement'  // Simulasi sukses
      })
    });
    const data = await res.json();
    console.log('PAYMENT CONFIRM RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "paymentStatus": "succeeded",
  "transactionStatus": "settlement",
  "orderId": "RECURRING-INIT-100"
}
```

✅ **Test Passed Jika:**
- `success: true`
- `paymentStatus: 'succeeded'`

### Check Database Again
```sql
SELECT 
  id, 
  amount, 
  payment_status, 
  recurring_type, 
  processed_at
FROM "Donations"
WHERE id = 100;
```

**Expected After Payment:**
```
 id  | amount  | payment_status | recurring_type | processed_at
-----+---------+----------------+----------------+--
 100 | 100000  | succeeded      | monthly        | 2024-05-10 10:35:00
```

✅ **Test Passed Jika:**
- `payment_status = 'succeeded'` ✅
- `processed_at` terisi dengan timestamp ✅

---

## 🔧 Test Scenario 4: Verify Campaign Updated

### Check Campaign Collected Amount

```bash
node -e "
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/campaigns/1');  // Ganti ID
    const data = await res.json();
    console.log('CAMPAIGN DATA:');
    console.log('Campaign:', data.title);
    console.log('Goal:', data.goal);
    console.log('Collected:', data.collected);
    console.log('Progress:', (data.collected / data.goal * 100).toFixed(1) + '%');
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected:**
```
Campaign: Test Recurring Campaign
Goal: 10000000
Collected: 100000    ← Bertambah setelah payment
Progress: 1.0%
```

✅ **Test Passed Jika:**
- Collected amount bertambah sesuai donation amount ✅

---

## 🔧 Test Scenario 5: Trigger Recurring Charge (Manual)

### Manually Trigger Cron Processing

Ini untuk test tanpa menunggu cron job berjalan di jadwal.

**Prerequisites:**
- Setup env variable `ADMIN_PROCESS_KEY` di `.env`

```bash
# Edit .env terlebih dahulu
# ADMIN_PROCESS_KEY=your-secret-key-here
```

**Trigger Processing:**
```bash
node -e "
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/recurring/process-now', {
      method: 'POST',
      headers: { 'x-admin-key': 'your-secret-key-here' }
    });
    const data = await res.json();
    console.log('PROCESSING RESULT:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Recurring donation processing triggered",
  "result": {
    "total": 1,
    "processed": 0,      // 0 karena baru 1 jam lalu (interval belum tercapai)
    "succeeded": 0,
    "failed": 0
  }
}
```

**Note:** Charge belum trigger karena interval belum tercapai (30 hari untuk monthly).

---

## 🔧 Test Scenario 6: Force Test Charge (Update processedAt)

Untuk testing cepat, ubah `processedAt` donor agar seolah-olah sudah 30 hari:

```sql
-- Update processedAt ke 31 hari yang lalu
UPDATE "Donations"
SET processed_at = NOW() - INTERVAL '31 days'
WHERE id = 100;

-- Verify
SELECT id, processed_at, NOW() - processed_at as days_ago
FROM "Donations"
WHERE id = 100;
```

**Expected:**
```
 id  | processed_at           | days_ago
-----+------------------------+--
 100 | 2024-04-09 10:35:00    | 31 days
```

✅ Sekarang `processedAt` lebih dari 30 hari, charge akan trigger.

---

## 🔧 Test Scenario 7: Verify Charge Triggered

### Trigger Processing Lagi

```bash
node -e "
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/recurring/process-now', {
      method: 'POST',
      headers: { 'x-admin-key': 'your-secret-key-here' }
    });
    const data = await res.json();
    console.log('PROCESSING RESULT:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Recurring donation processing triggered",
  "result": {
    "total": 1,
    "processed": 1,      // ← Sekarang 1! Karena interval tercapai
    "succeeded": 1,      // ← Berhasil di-process
    "failed": 0
  }
}
```

✅ **Test Passed Jika:**
- `processed: 1` ✅
- `succeeded: 1` ✅

### Check Database untuk Charge Baru

```sql
-- Lihat semua donations untuk campaign ini
SELECT 
  id, 
  parent_recurring_donation_id,
  amount, 
  payment_status, 
  recurring_type, 
  created_at
FROM "Donations"
WHERE campaign_id = 1
ORDER BY created_at DESC;
```

**Expected:**
```
 id  | parent_recurring_donation_id | amount  | payment_status | recurring_type | created_at
-----+------------------------------+---------+----------------+----------------+--
 101 |                          100 | 100000  | processing     | one-time       | 2024-05-10 10:40:00  ← CHILD (charge)
 100 |                           \N | 100000  | succeeded      | monthly        | 2024-05-10 10:30:00  ← PARENT
(2 rows)
```

✅ **Test Passed Jika:**
- Ada donation baru dengan `id = 101` ✅
- `parent_recurring_donation_id = 100` ✅
- `recurring_type = 'one-time'` (charge individual) ✅
- `payment_status = 'processing'` ✅

---

## 🔧 Test Scenario 8: User List Recurring Donations

### Get Recurring List untuk User

Pertama, buat/login user terlebih dahulu:

```bash
# Register/Login user
node -e "
(async () => {
  try {
    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testdonor@example.com',
        password: 'password123'  // atau setup user dulu
      })
    });
    const data = await res.json();
    console.log('LOGIN RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Get JWT token dari response**, kemudian:

```bash
node -e "
(async () => {
  try {
    const token = 'JWT_TOKEN_DARI_LOGIN';  // Ganti dengan token
    const res = await fetch('http://localhost:4000/api/recurring/list', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    console.log('RECURRING LIST:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "recurringDonations": [
    {
      "id": 100,
      "campaignId": 1,
      "campaignTitle": "Test Recurring Campaign",
      "amount": 100000,
      "recurringType": "monthly",
      "paymentStatus": "succeeded",
      "paymentMethod": "bank_transfer",
      "message": "Test recurring monthly donation",
      "createdAt": "2024-05-10T10:30:00.000Z",
      "processedAt": "2024-05-10T10:35:00.000Z",
      "nextChargeEstimate": "2024-06-09T10:35:00.000Z"
    }
  ],
  "totalMonthly": 100000,
  "totalYearly": 0
}
```

✅ **Test Passed Jika:**
- `recurringDonations` tidak kosong ✅
- `nextChargeEstimate` terisi ✅
- `totalMonthly` = sum dari monthly donations ✅

---

## 🔧 Test Scenario 9: Get Charge History

```bash
node -e "
(async () => {
  try {
    const token = 'JWT_TOKEN_DARI_LOGIN';  // Ganti dengan token
    const res = await fetch('http://localhost:4000/api/recurring/details/100', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    console.log('RECURRING DETAILS:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "donation": {
    "id": 100,
    "campaignId": 1,
    "campaignTitle": "Test Recurring Campaign",
    "amount": 100000,
    "recurringType": "monthly",
    "paymentStatus": "succeeded",
    ...
    "nextChargeEstimate": "2024-06-09T10:35:00.000Z"
  },
  "chargeHistory": [
    {
      "id": 101,
      "amount": 100000,
      "status": "processing",
      "chargedAt": "2024-05-10T10:40:00.000Z"
    }
  ]
}
```

✅ **Test Passed Jika:**
- `chargeHistory` menampilkan charge yang sudah dilakukan ✅
- Setiap charge punya `id, amount, status, chargedAt` ✅

---

## 🔧 Test Scenario 10: Cancel Recurring Donation

```bash
node -e "
(async () => {
  try {
    const token = 'JWT_TOKEN_DARI_LOGIN';  // Ganti dengan token
    const res = await fetch('http://localhost:4000/api/recurring/cancel/100', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    console.log('CANCEL RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Donasi rutin dibatalkan. Charge berikutnya tidak akan dilakukan."
}
```

### Verify di Database

```sql
SELECT id, recurring_type, payment_status, created_at
FROM "Donations"
WHERE id = 100;
```

**Expected:**
```
 id  | recurring_type | payment_status | created_at
-----+----------------+----------------+--
 100 | one-time       | refunded       | 2024-05-10 10:30:00
```

✅ **Test Passed Jika:**
- `recurring_type` berubah menjadi `'one-time'` ✅
- `payment_status` berubah menjadi `'refunded'` ✅

---

## 📊 Summary Checklist

| Test Case | Command/Step | Expected Result | Status |
|-----------|--------------|-----------------|--------|
| 1. Setup recurring | `POST /api/recurring/setup` | Status 200, token generated | [ ] |
| 2. DB record created | Query `Donations` table | `recurring_type = 'monthly'` | [ ] |
| 3. Payment confirmed | `POST /api/payments/confirm` | `paymentStatus = 'succeeded'` | [ ] |
| 4. Campaign updated | `GET /api/campaigns/1` | `collected` bertambah | [ ] |
| 5. Manual trigger | `POST /api/recurring/process-now` | `processed = 1` | [ ] |
| 6. Charge created | Query `Donations` | Child donation ada | [ ] |
| 7. User list | `GET /api/recurring/list` | Recurring donation ada | [ ] |
| 8. Charge history | `GET /api/recurring/details/:id` | `chargeHistory` ada | [ ] |
| 9. Cancel recurring | `POST /api/recurring/cancel/:id` | `recurring_type = 'one-time'` | [ ] |
| 10. Verify cancel | Query `Donations` | `payment_status = 'refunded'` | [ ] |

---

## 🔍 Troubleshooting

### ❌ Error: "Unauthorized - invalid admin key"
**Solusi:** Pastikan `ADMIN_PROCESS_KEY` sudah di set di `.env`
```env
ADMIN_PROCESS_KEY=your-secret-key-here
```
Restart server setelah update `.env`.

### ❌ Error: "Campaign not found"
**Solusi:** Pastikan `campaignId` valid. Query campaigns dulu:
```sql
SELECT id, title FROM "Campaigns" LIMIT 5;
```

### ❌ Error: "Unauthorized" saat list recurring
**Solusi:** JWT token invalid atau expired. Login ulang:
```bash
# Get token dari login response
node -e "fetch('http://localhost:4000/api/auth/login', {...})"
```

### ❌ Charge tidak trigger saat process-now
**Solusi:** `processedAt` belum melewati interval. Update database:
```sql
UPDATE "Donations" 
SET processed_at = NOW() - INTERVAL '31 days'
WHERE id = 100 AND recurring_type IN ('monthly', 'yearly');
```

---

## 📝 Test Report Template

Copy-paste ke file untuk dokumentasi:

```markdown
# Test Report: Recurring Donations

**Date:** 2024-05-10
**Tester:** [Your Name]
**Campaign ID:** 1
**Recurring Donation ID:** 100

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Setup recurring | PASS / FAIL | |
| Payment confirmed | PASS / FAIL | |
| Campaign updated | PASS / FAIL | |
| Charge triggered | PASS / FAIL | |
| User list | PASS / FAIL | |
| Cancel recurring | PASS / FAIL | |

## Summary
- ✅ Recurring donation system working as expected
- ⚠️ [Jika ada issue] Issues found: ...

## Screenshots
[Attach screenshots of response/UI]
```

---

## ⏰ Automatic Testing (Cron Job)

Jika ingin test cron job yang berjalan otomatis (bukan manual):

1. Setup recurring donation
2. Update `processedAt` ke 31 hari lalu
3. Tunggu sampai **jam 02:00 UTC** (09:00 WIB)
4. Check database/logs di server untuk verify charge dilakukan otomatis

**Log yang akan terlihat di server:**
```
[Cron] Starting daily recurring donation processing...
[RecurringService] Found 1 recurring donations to check
[RecurringService] Processing donation ID 100 (monthly)
[RecurringService] Processing complete: 1 succeeded, 0 failed out of 1 processed
[Cron] Recurring donation processing completed: {...}
```

---

## ✅ All Tests Passed?

Jika semua test di atas PASS ✅, maka:

✅ **Donasi Rutin BERHASIL Diimplementasikan!**
- Setup recurring donation: **WORKING**
- Automatic payment processing: **WORKING**
- Charge history tracking: **WORKING**
- User management: **WORKING**
- Database integrity: **WORKING**

🎉 **Ready untuk Production Deployment!**
