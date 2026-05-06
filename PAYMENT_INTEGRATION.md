## 💳 Midtrans Payment Integration Guide

### Current Status
- ✅ Backend: Midtrans endpoints ready (`/api/payments/create-intent`, `/api/payments/confirm`, `/api/payments/webhook`)
- ✅ Payment flow: Create transaction → Get Snap token → Confirm
- ⏳ Frontend: PaymentModal needs Snap SDK integration

---

## Frontend Integration Steps

### Step 1: Add Midtrans Snap SDK to HTML

In `index.html`, add script tag:
```html
<head>
  <!-- ... existing scripts ... -->
  <script src="https://app.sandbox.midtrans.com/snap/snap.js"></script>
  <!-- Or production: https://app.midtrans.com/snap/snap.js -->
</head>
```

### Step 2: Update PaymentModal.tsx

Replace Stripe logic with Midtrans:

```typescript
// src/app/components/PaymentModal.tsx

// 1. Import snap setup
declare global {
  interface Window {
    snap: {
      pay: (token: string, options: any) => void;
      embed: (token: string, options: any) => void;
    };
  }
}

// 2. Update payment creation
const handleCreatePayment = async () => {
  try {
    setLoading(true);
    
    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: paymentAmount,
        campaignId,
        donorName: formData.name,
        donorEmail: formData.email,
        paymentMethod: selectedMethod || 'bank_transfer',
        isAnonymous: formData.anonymous,
        message: formData.message,
        recurringType: 'one-time'
      })
    });

    const data = await response.json();
    
    if (!data.transactionToken) {
      throw new Error('Failed to create transaction');
    }

    // Store transaction details
    setTransaction({
      token: data.transactionToken,
      orderId: data.orderId,
      donationId: data.donationId
    });

    // Open Midtrans Snap payment
    window.snap.pay(data.transactionToken, {
      onSuccess: (result: any) => handlePaymentSuccess(result),
      onPending: (result: any) => handlePaymentPending(result),
      onError: (result: any) => handlePaymentError(result),
      onClose: () => setShowPayment(false)
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    setError('Gagal membuat transaksi');
  }
};

// 3. Handle payment callbacks
const handlePaymentSuccess = async (result: any) => {
  try {
    // Verify dengan backend
    const confirmResponse = await fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donationId: transaction?.donationId,
        orderId: transaction?.orderId,
        transactionId: result.transaction_id
      })
    });

    const data = await confirmResponse.json();
    
    if (data.success) {
      setPaymentStatus('success');
      setShowPayment(false);
      // Callback to parent (CampaignDetail) to refresh data
      onPaymentSuccess?.();
    }
  } catch (error) {
    console.error('Confirmation error:', error);
    setError('Gagal mengkonfirmasi pembayaran');
  }
};

const handlePaymentPending = (result: any) => {
  setPaymentStatus('pending');
  console.log('Payment pending:', result);
};

const handlePaymentError = (result: any) => {
  setError(`Pembayaran gagal: ${result.status_message}`);
  setPaymentStatus('error');
};
```

### Step 3: Update Environment Variables

Pastikan di `.env` sudah ada:
```env
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxx
# Frontend hanya butuh client key untuk Snap
```

### Step 4: Add Midtrans Client Key to Frontend Config

Create `src/config.ts`:
```typescript
export const MIDTRANS_CONFIG = {
  clientKey: import.meta.env.VITE_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxx',
  isProduction: import.meta.env.PROD || false,
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000'
};
```

---

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Clicks Donasi                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ Form: name, amount, etc  │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌─────────────────────────────────────┐
        │ POST /api/payments/create-intent    │
        │ Response: { transactionToken, ... } │
        └──────────────┬──────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ window.snap.pay(token)   │
        │ Midtrans Snap Opens      │
        └──────────────┬───────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
    ✓ Success                   ✗ Error/Close
        │                             │
        ▼                             ▼
   Confirm Backend              Close modal
   /api/payments/confirm
        │
        ├─ Valid: Update UI
        └─ Invalid: Show error
```

---

## Demo vs Real Mode

### Demo Mode (Testing)
```env
PAYMENT_DEMO=true
```
- Tidak perlu Snap token
- Pembayaran instant (tidak ada UI Midtrans)
- Cocok untuk testing flow tanpa sandbox account

### Real Mode (Sandbox)
```env
PAYMENT_DEMO=false
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_SERVER_KEY=SB-Mid-server-... (backend only)
```
- Menggunakan Midtrans Snap popup
- Real sandbox payment flow
- Test dengan card: 4111 1111 1111 1111

---

## Testing Payment Methods

### 1. Bank Transfer (BCA)
```
Order → Snap Opens → Pilih "Bank Transfer" 
→ Virtual Account diberikan 
→ Simulasikan pembayaran di Midtrans Dashboard
```

### 2. E-Wallet (GoPay, OVO, LinkAja)
```
Order → Snap Opens → Pilih "E-Wallet" 
→ QR Code / Link diberikan
→ Scan dari test app di Midtrans dashboard
```

### 3. Credit Card
```
Card: 4111 1111 1111 1111
Exp: 12/25
CVV: 123
OTP: 123456
```

---

## Frontend API Client (Recommended)

Create `src/services/paymentService.ts`:
```typescript
export const paymentService = {
  createPayment: async (payload: CreatePaymentPayload) => {
    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  },

  confirmPayment: async (donationId: number, orderId: string, transactionId: string) => {
    const response = await fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donationId, orderId, transactionId })
    });
    return response.json();
  },

  getPaymentStatus: async (orderId: string) => {
    const response = await fetch(`/api/payments/status/${orderId}`);
    return response.json();
  }
};
```

---

## Webhook Integration (Backend Only)

Sudah implemented di `server/routes/payments.js`:

```typescript
POST /api/payments/webhook

Midtrans kirim notifikasi ke endpoint ini ketika:
- Payment settlement
- Payment failed
- Transaction expired
- Etc.

Handler:
- Update donation status
- Update campaign collected amount
- Log untuk audit
```

To enable webhook di Midtrans Dashboard:
1. Settings → Notification URL
2. Set: `https://yourdomain.com/api/payments/webhook`
3. Method: POST
4. Save

---

## Current Implementation Status

### ✅ Completed
- [x] Backend Midtrans integration
- [x] Payment endpoints
- [x] Webhook handler
- [x] Database models
- [x] Error handling
- [x] Demo mode

### ⏳ In Progress
- [ ] Frontend Snap SDK integration
- [ ] PaymentModal Midtrans flow
- [ ] Client key configuration

### ❌ Not Started
- [ ] Recurring donations
- [ ] Subscription webhook handling
- [ ] Payment analytics
- [ ] Transaction history UI

---

## Common Issues & Solutions

### Issue: Snap not loading
```
// Check if script loaded
if (!window.snap) {
  console.error('Snap SDK not loaded');
  // Retry loading or show fallback
}
```

### Issue: CORS error when calling webhook
```
Webhook dari Midtrans akan langsung hit backend
Tidak perlu CORS config khusus
Check: CORS allowed untuk POST /api/payments/webhook
```

### Issue: Transaction token expired
```
- Token valid untuk ~15 minutes
- Jika user terlalu lama → request new token
- Implement: Auto refresh sebelum expiry
```

### Issue: Double payment (idempotency)
```
Midtrans handle di server-side dengan order_id
Sama order_id = sama transaction
Jangan buat duplicate donations
```

---

## Next Phase: Recurring Donations

Frontend changes needed:
```typescript
// Add frequency selector
<select value={frequency} onChange={e => setFrequency(e.target.value)}>
  <option value="one-time">Sekali saja</option>
  <option value="monthly">Bulanan</option>
  <option value="yearly">Tahunan</option>
</select>

// Send to backend
{
  amount,
  campaignId,
  recurringType: frequency, // "one-time" | "monthly" | "yearly"
  ...
}

// Backend akan handle subscription creation otomatis
```

---

## References

- Midtrans Docs: https://docs.midtrans.com
- Snap Integration: https://docs.midtrans.com/en/snap/overview
- Testing Guide: https://docs.midtrans.com/en/snap/sandbox-environment
- Payment Methods: https://docs.midtrans.com/en/snap/payment-method

---

Good luck with integration! 🚀
