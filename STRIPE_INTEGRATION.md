# Payment Gateway Stripe Implementation Guide

## Overview
This document explains the Stripe payment gateway implementation for BantuSesama, including:
- One-time donations
- Recurring donations (monthly/yearly)
- Payment processing and confirmation
- Webhook handling for payment events

## Installation

### 1. Install Stripe Dependencies

Frontend:
```bash
npm install @stripe/js @stripe/react-stripe-js
```

Backend already includes:
```bash
npm install stripe --save
```

### 2. Environment Variables

Create `.env` in the `server/` directory:
```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

Create `.env` in the root directory for frontend:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
VITE_API_URL=http://localhost:4000
```

## Getting Stripe Keys

1. Sign up at [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to "Developers" > "API Keys"
3. Copy test keys initially
4. For webhook secret: "Developers" > "Webhooks" > "Add endpoint"
   - Endpoint URL: `http://localhost:4000/api/payments/webhook` (or your production URL)
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted`

## API Endpoints

### 1. Create Payment Intent
**POST** `/api/payments/create-intent`

Request:
```json
{
  "amount": 100000,
  "campaignId": 1,
  "recurringType": "one-time",
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "isAnonymous": false,
  "message": "Keep up the good work!",
  "currency": "IDR"
}
```

Response:
```json
{
  "clientSecret": "pi_1234_secret_5678",
  "paymentIntentId": "pi_1234",
  "donationId": 42
}
```

### 2. Confirm Payment
**POST** `/api/payments/confirm`

Request:
```json
{
  "paymentIntentId": "pi_1234",
  "donationId": 42
}
```

### 3. Get Campaign Donations
**GET** `/api/payments/campaign/:campaignId/donations`

Returns all successful donations for a campaign (public endpoint).

### 4. Create Subscription
**POST** `/api/payments/create-subscription`

For recurring donations with saved payment method.

### 5. Webhook
**POST** `/api/payments/webhook`

Handles Stripe webhook events.

## Database Schema

### Donation Table
- `id` - Primary key
- `campaignId` - Foreign key to Campaign
- `userId` - Foreign key to User
- `amount` - Donation amount (DECIMAL)
- `currency` - Currency code (default: IDR)
- `paymentStatus` - pending | processing | succeeded | failed | refunded
- `recurringType` - one-time | monthly | yearly
- `stripePaymentIntentId` - Stripe payment intent ID
- `stripeSubscriptionId` - Stripe subscription ID (for recurring)
- `donorName` - Name of donor
- `donorEmail` - Email of donor
- `isAnonymous` - Boolean flag
- `message` - Donor message
- `failureReason` - Error message if failed
- `processedAt` - Timestamp when payment was processed

## Frontend Integration

### PaymentModal Component

The `PaymentModal` component handles the complete donation flow:

1. **Identity Step** - Collect donor info
2. **Amount Step** - Select amount and recurring option
3. **Payment Step** - Stripe CardElement payment
4. **Success/Error Step** - Confirmation

Usage:
```tsx
import { PaymentModal } from './components/PaymentModal';

<PaymentModal 
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  campaignId={1}
  campaignTitle="Help UMKM Recover"
  user={currentUser}
/>
```

## Payment Flow

### One-Time Donation
1. User fills identity and amount
2. Frontend calls `POST /api/payments/create-intent`
3. Backend creates Stripe PaymentIntent and Donation record
4. Frontend confirms payment with Stripe CardElement
5. Frontend calls `POST /api/payments/confirm`
6. Webhook confirms and updates campaign stats

### Recurring Donation
1. Similar to one-time, but with subscription setup
2. Frontend calls `POST /api/payments/create-subscription`
3. Backend creates Stripe subscription
4. Monthly/yearly invoices are automatically charged
5. Webhook creates new donation records on each successful charge

## Testing

### Test Card Numbers
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

CVV: Any 3 digits
Expiry: Any future date (MM/YY)

### Test Webhook Locally
Use Stripe CLI:
```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
# Copy the webhook signing secret
```

## Security Considerations

1. **API Keys**: Store secret keys in server environment variables only
2. **HTTPS**: Ensure HTTPS is enabled in production
3. **Token Security**: Never expose Stripe tokens in logs
4. **CORS**: Payment routes require authentication middleware
5. **PCI Compliance**: Use Stripe's PCI-compliant solution (CardElement)

## Troubleshooting

### "Stripe not initialized"
- Check VITE_STRIPE_PUBLISHABLE_KEY is set
- Verify Stripe scripts are loading

### "Payment intent not found"
- Check database connection
- Verify Donation records are being created
- Check backend logs

### Webhook not processing
- Verify webhook secret matches exactly
- Check server is receiving webhook calls
- Enable Stripe CLI for local testing

## Production Checklist

- [ ] Use live Stripe keys
- [ ] Enable HTTPS
- [ ] Set up production webhook endpoint
- [ ] Test with real payment methods
- [ ] Monitor Stripe dashboard for disputes
- [ ] Set up email notifications
- [ ] Configure refund policies
- [ ] Test recurring payments end-to-end
- [ ] Audit transaction logs

## References

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe React Integration](https://stripe.com/docs/stripe-js/react)
- [Payment Intent API](https://stripe.com/docs/api/payment_intents)
- [Subscriptions](https://stripe.com/docs/billing/subscriptions)
