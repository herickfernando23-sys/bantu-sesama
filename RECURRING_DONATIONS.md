# Fitur Donasi Rutin (Recurring Donations)

## Deskripsi
Platform BantuSesama mendukung donasi rutin otomatis setiap bulan atau per tahun. Fitur ini memungkinkan donatur tetap untuk memberikan kontribusi berkala tanpa perlu melakukan transaksi berulang kali secara manual.

## Arsitektur

### Database
- **Model**: `Donation` dengan field `recurringType` (ENUM: one-time, monthly, yearly)
- **Relasi**: Self-referencing untuk tracking parent donation → child charges
- **Field Baru**: `parentRecurringDonationId` (untuk link charge ke parent recurring)

### Backend Service
- **File**: `server/services/recurringPaymentService.js`
- **Fungsi Utama**:
  - `processRecurringDonations()` - Check dan process donasi yang jatuh tempo
  - `chargeRecurringDonation()` - Trigger charge Midtrans untuk recurring
  - `getUserRecurringDonations()` - Get daftar recurring donasi user
  - `cancelRecurringDonation()` - Cancel recurring donation
  - `updateRecurringDonation()` - Update amount/frequency

### Scheduler
- **Tool**: `node-cron` 
- **Schedule**: Setiap hari jam 02:00 UTC (09:00 WIB)
- **Job**: Call `processRecurringDonations()` otomatis
- **Location**: `server/index.js` - `setupRecurringCronJob()`

### Routes
- **File**: `server/routes/recurring.js`
- **Mount**: `/api/recurring`

---

## API Endpoints

### 1. Setup Recurring Donation
**POST** `/api/recurring/setup`

Create new recurring donation setup. Ini akan trigger charge pertama (initial charge) dan menjadwalkan charge berkala.

#### Request Body
```json
{
  "campaignId": 1,
  "amount": 100000,
  "recurringType": "monthly",  // atau "yearly"
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "paymentMethod": "bank_transfer",  // atau "gopay", "shopeepay", "credit_card"
  "isAnonymous": false,
  "message": "Mendukung UMKM yang terkena bencana"
}
```

#### Response (Success)
```json
{
  "success": true,
  "recurringDonationId": 15,
  "transactionToken": "MIDTRANS_TOKEN_HERE",
  "orderId": "RECURRING-INIT-15",
  "amount": 100000,
  "recurringType": "monthly",
  "campaignTitle": "Bantuan UMKM Terdampak Bencana",
  "message": "Pengaturan donasi rutin monthly berhasil. Silakan lakukan pembayaran untuk charge pertama."
}
```

#### Notes
- Minimal amount untuk recurring: **Rp 50.000**
- Charge pertama terjadi segera setelah payment sukses
- Charge berikutnya akan otomatis dilakukan sesuai jadwal (monthly/yearly)

---

### 2. Get User's Recurring Donations
**GET** `/api/recurring/list`

Get list semua recurring donations milik user yang sedang aktif.

#### Headers (Required)
```
Authorization: Bearer <JWT_TOKEN>
```

#### Response
```json
{
  "success": true,
  "recurringDonations": [
    {
      "id": 15,
      "campaignId": 1,
      "campaignTitle": "Bantuan UMKM Terdampak Bencana",
      "amount": 100000,
      "recurringType": "monthly",
      "paymentStatus": "succeeded",
      "paymentMethod": "bank_transfer",
      "message": "Mendukung UMKM",
      "createdAt": "2024-05-10T10:30:00Z",
      "processedAt": "2024-05-10T10:35:00Z",
      "nextChargeEstimate": "2024-06-09T10:35:00Z"
    }
  ],
  "totalMonthly": 200000,
  "totalYearly": 500000
}
```

---

### 3. Get Recurring Donation Details
**GET** `/api/recurring/details/:recurringDonationId`

Get detail specific recurring donation + riwayat charges.

#### Headers (Required)
```
Authorization: Bearer <JWT_TOKEN>
```

#### Response
```json
{
  "success": true,
  "donation": {
    "id": 15,
    "campaignId": 1,
    "campaignTitle": "Bantuan UMKM",
    "amount": 100000,
    "recurringType": "monthly",
    "paymentStatus": "succeeded",
    "paymentMethod": "bank_transfer",
    "donorName": "John Doe",
    "donorEmail": "john@example.com",
    "isAnonymous": false,
    "message": "Mendukung UMKM",
    "createdAt": "2024-05-10T10:30:00Z",
    "processedAt": "2024-05-10T10:35:00Z",
    "nextChargeEstimate": "2024-06-09T10:35:00Z"
  },
  "chargeHistory": [
    {
      "id": 16,
      "amount": 100000,
      "status": "succeeded",
      "chargedAt": "2024-06-10T09:05:00Z"
    },
    {
      "id": 17,
      "amount": 100000,
      "status": "succeeded",
      "chargedAt": "2024-07-10T09:05:00Z"
    }
  ]
}
```

---

### 4. Cancel Recurring Donation
**POST** `/api/recurring/cancel/:recurringDonationId`

Stop recurring donation. Charge berikutnya tidak akan dilakukan.

#### Headers (Required)
```
Authorization: Bearer <JWT_TOKEN>
```

#### Response
```json
{
  "success": true,
  "message": "Donasi rutin dibatalkan. Charge berikutnya tidak akan dilakukan."
}
```

---

### 5. Update Recurring Donation
**PUT** `/api/recurring/update/:recurringDonationId`

Update amount dan/atau frequency recurring donation.

#### Headers (Required)
```
Authorization: Bearer <JWT_TOKEN>
```

#### Request Body
```json
{
  "amount": 150000,           // Optional
  "recurringType": "yearly"   // Optional
}
```

#### Response
```json
{
  "success": true,
  "message": "Donasi rutin berhasil diperbarui",
  "donation": {
    "id": 15,
    "amount": 150000,
    "recurringType": "yearly"
  }
}
```

---

### 6. Manual Trigger Recurring Processing (Admin)
**POST** `/api/recurring/process-now`

Trigger recurring donation processing manually (untuk testing/urgent). Memerlukan admin key.

#### Headers
```
x-admin-key: <ADMIN_PROCESS_KEY>
```

atau

#### Request Body
```json
{
  "adminKey": "<ADMIN_PROCESS_KEY>"
}
```

#### Response
```json
{
  "success": true,
  "message": "Recurring donation processing triggered",
  "result": {
    "total": 25,
    "processed": 5,
    "succeeded": 4,
    "failed": 1
  }
}
```

---

## Flow Diagram

### 1. Setup Initial Recurring Donation
```
User submits recurring setup form
    ↓
Backend creates Donation record (recurringType=monthly/yearly)
    ↓
Midtrans transaction created for initial charge
    ↓
Return transactionToken to frontend
    ↓
User completes payment (same as one-time)
    ↓
Payment webhook confirms success
    ↓
Donation marked as 'succeeded'
    ↓
Scheduled cron job will process future charges
```

### 2. Automatic Recurring Charge (Daily Cron)
```
Cron job runs at 02:00 UTC daily
    ↓
Check all donations with recurringType=monthly/yearly
    ↓
Calculate time since last charge
    ↓
If interval exceeded (30 days for monthly, 365 for yearly):
    ├─ Create new Donation record (child charge)
    ├─ Trigger Midtrans transaction
    ├─ Store transaction details
    └─ Update processedAt timestamp
    ↓
Webhook handles payment confirmation
    ↓
Update campaign collected amount
    ↓
Log charge to charge history
```

---

## Environment Variables

Add ke `.env`:

```env
# Admin key untuk manual processing trigger
ADMIN_PROCESS_KEY=your_secret_admin_key_here

# Cron schedule (optional - untuk override default)
# Format cron: "minute hour day month dayOfWeek"
# RECURRING_CRON_SCHEDULE=0 2 * * *
```

---

## Database Changes

### New Field: Donation Model
```sql
ALTER TABLE "Donations" ADD COLUMN "parentRecurringDonationId" INTEGER REFERENCES "Donations"("id");
CREATE INDEX "idx_donations_parent_recurring" ON "Donations"("parentRecurringDonationId");
```

Sequelize akan auto-run saat `sequelize.sync({ alter: true })`.

---

## Frontend Integration

### Setup Form Component
```tsx
// Opsi recurring type
const recurringOptions = [
  { label: 'Sekali (One-time)', value: 'one-time' },
  { label: 'Setiap Bulan (Monthly)', value: 'monthly' },
  { label: 'Setiap Tahun (Yearly)', value: 'yearly' }
];

// Minimal amount per tipe
const minAmount = {
  'one-time': 10000,
  'monthly': 50000,
  'yearly': 50000
};

// Submit to /api/payments/create-intent with recurringType
const handleDonate = async () => {
  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({
      campaignId,
      amount,
      recurringType,  // one-time, monthly, or yearly
      donorName,
      donorEmail,
      paymentMethod
    })
  });
};
```

### Manage Recurring Page
```tsx
// Show user's recurring donations
useEffect(() => {
  fetch('/api/recurring/list', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(data => setRecurringDonations(data.recurringDonations));
}, [token]);

// Cancel recurring
const handleCancel = (recurringId) => {
  fetch(`/api/recurring/cancel/${recurringId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};
```

---

## Testing

### Test Setup Recurring Donation
```bash
curl -X POST http://localhost:4000/api/recurring/setup \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": 1,
    "amount": 100000,
    "recurringType": "monthly",
    "donorName": "Test User",
    "donorEmail": "test@example.com",
    "paymentMethod": "bank_transfer",
    "message": "Test recurring donation"
  }'
```

### Trigger Manual Processing (Testing)
```bash
curl -X POST http://localhost:4000/api/recurring/process-now \
  -H "x-admin-key: your_secret_admin_key_here"
```

### Check Recurring List (dengan auth)
```bash
curl http://localhost:4000/api/recurring/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Recurring charges not processing | Cron job tidak running | Pastikan `node-cron` installed, restart server |
| Payment failed untuk recurring | Midtrans error | Check Midtrans logs, verify serverKey |
| Donation tidak muncul di list | User tidak authenticated | Ensure JWT token valid |
| Charge duplikat | Race condition di cron | Check processedAt timestamp logic |

---

## Future Enhancements

- [ ] Webhook verification signature untuk Midtrans callback
- [ ] Save payment method token untuk recurring tanpa re-payment
- [ ] Pause/Resume recurring (bukan hanya cancel)
- [ ] Custom schedule (bukan hanya monthly/yearly)
- [ ] Email notification untuk upcoming charge
- [ ] Admin dashboard untuk monitor recurring donations
- [ ] Automatic retry logic untuk failed charges
- [ ] Integration dengan Stripe recurring billing (alternative)
