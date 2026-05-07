# Micro-Crowdfunding Platform - Comprehensive Codebase Overview

## 1. Project Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS 4, Radix UI, shadcn/ui
- **Backend**: Node.js + Express, Sequelize ORM, PostgreSQL
- **Payment**: Midtrans (primary), Stripe integration (in models)
- **Authentication**: JWT, bcrypt password hashing

### Directory Structure
```
Frontend (src/app/)
  ├── App.tsx                 # Main app with routing
  ├── components/            # React components
  ├── styles/               # CSS & Tailwind configs
  └── mocks/                # Mock data

Backend (server/)
  ├── index.js              # Express server setup
  ├── models/               # Sequelize models
  ├── routes/               # API endpoints
  └── middleware/           # Auth & optional auth
```

---

## 2. Campaign Creation/Editing Flow

### CreateCampaign Component (`src/app/components/CreateCampaign.tsx`)

**Flow:**
1. User fills form with campaign details
2. Validates all required fields on submit
3. Converts image to Base64 data URL
4. Sends POST to `/api/campaigns` with campaign data
5. Campaign created with status: 'pending' (awaits admin verification)

**Form Fields:**
- Title (required)
- Description (required) - short summary
- Full Description (optional) - detailed story
- Category (UMKM Terdampak Bencana, Kesehatan, Pendidikan, Kemanusiaan)
- Target Amount (required) - with quick-select buttons (2M, 5M, 10M, 25M, 50M)
- Location (required) - dropdown with all Indonesian provinces
- Image Upload (optional) - file input with preview

**Image Handling:**
- Stored as **Base64 data URL** in campaign object
- No server-side image storage (uses data URLs)
- FileReader API converts file to base64
- Falls back to default image if none provided
- Stored in campaign.image field (TEXT in DB)

**Backend Processing** (`server/routes/campaigns.js`):
```javascript
POST /api/campaigns
- Creates Campaign record in PostgreSQL
- Sets status to 'pending' by default
- Associates with creator's email and name
- Returns created campaign with ID
```

### Campaign Editing (CampaignDetail Component)
- Only campaign creator can edit (matched by email)
- Editable fields: title, description, story, image, target, location, category, organizer
- Fund allocation breakdown and disbursement history can be tracked
- Changes reflected in real-time in app state

---

## 3. Image Upload Handling

### Frontend Image Processing
**Location:** `src/app/components/CreateCampaign.tsx` & `CampaignDetail.tsx`

```typescript
handleImageChange(file: File | null) {
  - Reads file using FileReader API
  - Converts to Base64 data URL
  - Stores in imagePreview state for display
  - Displays preview before submission
}
```

**Data Flow:**
```
File Input → FileReader.readAsDataURL() → Base64 String → JSON Payload → DB
```

**Storage Details:**
- No external file service (AWS S3, etc.)
- Base64 encoded in `campaign.image` field (TEXT column)
- Included in JSON payload to `/api/campaigns`
- Retrieved as-is from campaign object

**Limitations:**
- Base64 increases payload size (~33% larger than binary)
- Not suitable for high-res images
- Simpler than file server approach but less scalable

---

## 4. Authentication & Session Persistence

### Frontend Authentication (`src/app/components/LoginRegister.tsx`)

**Current Implementation:**
- **localStorage-based** (NOT server-backed initially)
- Demo users seeded into localStorage on first load
- Credentials stored in `bantusesama-registered-users` key

**Login Flow:**
```typescript
1. User enters email/password
2. Searches localStorage for matching user
3. Compares plaintext password (security risk!)
4. Calls onLogin() callback with user data
5. User object stored in App state
```

**Registration Flow:**
```typescript
1. Validates all fields
2. Password >= 6 chars, must match confirmation
3. Checks email not already registered
4. Stores new user in localStorage
5. Auto-login after registration
```

**Demo User:** `demo@example.com` / `password`

### Backend Authentication (`server/routes/auth.js`)

**JWT-based with bcrypt:**

```javascript
POST /api/auth/register
- Hash password with bcrypt (10 salt rounds)
- Check email uniqueness in DB
- Create User record
- Issue JWT token

POST /api/auth/login
- Find user by email
- Compare password hash with bcrypt.compare()
- Issue JWT token on success
```

**JWT Configuration:**
- Secret: `process.env.JWT_SECRET` or default 'change_me'
- Token includes user ID: `jwt.sign({ id: user.id }, secret)`

### Session Persistence

**Frontend:**
- User state stored in `App.tsx` component state
- NO localStorage persistence (resets on page reload)
- Navigation uses in-memory state

**Backend:**
- Stateless JWT authentication
- Each request includes `Authorization: Bearer <token>` header
- Token decoded via `optionalAuth` middleware

### Middleware

**auth.js** (required):
- Extracts JWT from Authorization header
- Verifies token signature
- Attaches user to `req.user`
- Returns 401 if invalid

**optionalAuth.js** (lenient):
- Attempts JWT verification
- Sets `req.user = null` if no token/invalid
- Always calls `next()` (doesn't block)
- Allows unauthenticated requests

---

## 5. Payment/Donation Functionality

### Donation Flow Architecture

```
PaymentModal.tsx (Frontend)
  ↓
Creates donation request
  ↓
POST /api/payments/create-intent (Backend)
  ↓
Donation record created in DB
  ↓
Midtrans transaction generated
  ↓
Snap.js popup rendered in browser
  ↓
User completes payment
  ↓
Callback → Payment confirmation
  ↓
Campaign.collected updated
```

### PaymentModal Component (`src/app/components/PaymentModal.tsx`)

**Steps:**
1. **Identity Step**: User enters name, email, anonymous toggle
2. **Amount Step**: Donor enters donation amount (min Rp 10,000)
3. **Payment Step**: Selects payment method (bank transfer, virtual account, e-wallet)
4. **Pending Step**: Shows payment status, VA numbers, redirect URLs
5. **Success Step**: Confirmation with donation details

**State Management:**
```typescript
- step: 'identity' | 'amount' | 'payment' | 'pending' | 'success' | 'error'
- donorName, donorEmail, isAnonymous, donorMessage
- amount, isRecurring (future monthly/yearly support)
- transactionToken, transactionId
```

**Pending Payments Storage:**
- Saved to localStorage: `bantusesama-pending-payments`
- Used to resume interrupted payments
- Contains: donationId, orderId, amount, method, redirectUrl

### Backend Payment Processing (`server/routes/payments.js` & `payments_midtrans.js`)

**POST /api/payments/create-intent:**
```javascript
1. Validate donor info and amount >= 10,000
2. Check campaign exists
3. Create Donation record in DB with status: 'pending'
4. Call Midtrans snap.createTransaction()
5. Return transactionToken for client-side Snap popup
```

**Midtrans Configuration:**
```javascript
snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION
  serverKey: process.env.MIDTRANS_SERVER_KEY
  clientKey: process.env.MIDTRANS_CLIENT_KEY
})
```

**Payment Methods Supported:**
- **Bank Transfer**: BCA, Mandiri, BNI, BRI, Permata
- **E-Wallets**: GoPay, OVO, ShopeePay, Dana, LinkAja
- **Credit Card**: Visa, Mastercard, etc.

**Demo Mode:**
- `PAYMENT_DEMO=true` generates fake transaction tokens
- Useful for testing without Midtrans credentials

### Payment Status Tracking

**POST /api/payments/status/{orderId}:**
- Queries Midtrans for transaction status
- Returns: succeeded, processing, failed, pending

**POST /api/payments/confirm:**
- Updates Donation record with final status
- Increments Campaign.collected amount
- Records processedAt timestamp

### Donation Model (`server/models/donation.js`)

```javascript
Donation {
  id: INTEGER (primary key)
  campaignId: INTEGER (FK to Campaign)
  userId: INTEGER (FK to User, nullable)
  amount: DECIMAL(15,2)
  currency: STRING (default: 'IDR')
  paymentStatus: ENUM (pending, processing, succeeded, failed, refunded)
  paymentMethod: STRING
  recurringType: ENUM (one-time, monthly, yearly)
  stripePaymentIntentId: STRING (unique, Stripe integration)
  stripeSubscriptionId: STRING
  midtransTransactionId: STRING
  midtransTransactionToken: TEXT
  donorName: STRING
  donorEmail: STRING
  isAnonymous: BOOLEAN
  message: TEXT
  failureReason: TEXT
  processedAt: DATETIME
  timestamps: true (createdAt, updatedAt)
}
```

### Recurring Donations
- Model supports: 'one-time', 'monthly', 'yearly'
- Currently only 'one-time' implemented
- Ready for future subscription feature

---

## 6. Admin Dashboard & Campaign Approval System

### AdminDashboard Component (`src/app/components/AdminDashboard.tsx`)

**Dashboard Stats:**
- Total Campaigns count
- Total funds raised (sum of all campaign.collected)
- Total donors (sum of all campaign.donors)
- Average progress %

**Admin Sections:**

1. **Pending Campaigns** (Verification Queue)
   - Shows campaigns with status: 'pending'
   - Actions: Verify (→ 'verified') or Reject (→ 'rejected')
   - Displays progress bar, category, location, organizer
   - Shows verification action buttons

2. **Rejected Campaigns**
   - Shows campaigns with status: 'rejected'
   - Can re-approve or delete

3. **Verified/Active Campaigns**
   - Displays published campaigns
   - Shows current fund collection progress

4. **User Management** (implied structure)
   - List of registered users
   - Roles: 'user' | 'admin'
   - Status: 'active' | 'pending'
   - Campaign count per user
   - Ability to delete users

5. **Withdrawal Requests** (Fundraiser payouts)
   - Track pending withdrawal requests
   - Status: 'Pending' | 'Success' | 'Rejected'
   - Update withdrawal approval status
   - Shows requested amount, note, date

### AdminLogin Component (`src/app/components/AdminLogin.tsx`)

- Separate login from regular user login
- Stores admin session in localStorage: `bantusesama-admin-session`
- Simple email-based authentication (hardcoded or localStorage)

### Campaign Verification Flow

**Frontend:**
```typescript
onVerifyCampaign(campaignId: number)
  → Updates campaign.status to 'verified'
  → Campaign now visible on public pages

onRejectCampaign(campaignId: number)
  → Updates campaign.status to 'rejected'
  → Campaign hidden from public view
  → Creator notified (TODO: implement email)
```

**Backend:** (TODO: Implement admin endpoints)
- `PUT /api/campaigns/:id/verify` - Admin only
- `PUT /api/campaigns/:id/reject` - Admin only
- `GET /api/campaigns?status=pending` - Get pending for verification

### Campaign Status Flow

```
User Creates Campaign
         ↓
    status: 'pending'
         ↓
Admin Reviews Campaign
    ↙           ↘
Approve      Reject
   ↓            ↓
verified    rejected
   ↓            ↓
Public     Hidden
```

---

## 7. Existing Chatbot Implementation

### Chatbot Component (`src/app/components/Chatbot.tsx`)

**Features:**
- **Floating button** (fixed position, bottom-right)
- **Chat window** (fixed, 96 chars wide × 500px height)
- **Message history** (displayed in chronological order)
- **Auto-responses** (regex-based pattern matching)

**Architecture:**
```typescript
State:
  - isOpen: boolean (window visibility)
  - messages: Message[] (chat history)
  - inputText: string (user input)

Message {
  id: number
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}
```

**Conversation Topics (Hardcoded Responses):**

| User Query | Bot Response |
|-----------|----------|
| "cara donasi", "cara berdonasi" | Donation step-by-step guide |
| "transparansi" | Link to transparency reports |
| "aman" | Security features checklist |
| "kampanye" | Campaign creation steps |
| "halo", "hi" | Friendly greeting |
| (default) | General help message |

**Technical Details:**
- Pure client-side (no backend integration)
- Case-insensitive pattern matching
- 500ms delay before bot response (simulates typing)
- Messages persist in component state (lost on refresh)
- No database storage

**Limitations:**
- No learning/ML
- No user context persistence
- No conversation history across sessions
- Limited to predefined patterns
- No handoff to human support

**Future Enhancement Opportunities:**
- Connect to backend chatbot API
- NLP-based intent recognition
- Admin escalation for complex queries
- Chat history in localStorage
- Integration with support ticketing system

---

## 8. API Routes Summary

### Authentication Routes (`/api/auth`)
```
POST /register
  - Input: { name, email, password }
  - Output: { token, user }
  - Hashes password with bcrypt

POST /login
  - Input: { email, password }
  - Output: { token, user }
  - Validates credentials
```

### Campaign Routes (`/api/campaigns`)
```
GET /
  - Retrieves all campaigns
  - Includes: Category, User (creator)

POST /
  - Create new campaign (optionalAuth)
  - Input: { title, description, goal, location, category, image, status, fullDescription }
  - Output: Created campaign with ID
  - Sets default status: 'pending'

GET /:id (TODO)
  - Get campaign details

PUT /:id (TODO)
  - Update campaign (creator only)

PUT /:id/verify (TODO - Admin)
  - Change status to 'verified'

PUT /:id/reject (TODO - Admin)
  - Change status to 'rejected'

DELETE /:id (TODO - Admin)
  - Remove campaign
```

### Payment Routes (`/api/payments`)
```
POST /create-intent
  - Create Midtrans transaction
  - Input: { amount, campaignId, donorName, donorEmail, isAnonymous, message, paymentMethod }
  - Output: { transactionToken, transactionId, donationId, orderId }
  - Creates Donation record with status: 'pending'

POST /status/:orderId
  - Query payment status from Midtrans
  - Output: { status, paymentStatus }

POST /confirm
  - Confirm payment completion
  - Updates Donation record
  - Increments Campaign.collected

GET /donations/:campaignId (TODO)
  - List donations for campaign

GET /my-donations (TODO)
  - List logged-in user's donations
```

### Payment Midtrans Routes (`/api/payments_midtrans`)
- Mirrors `/api/payments` with Midtrans-specific handling
- Some overlap/duplication with main payments route

### Planned Admin Routes (Not yet implemented)
```
GET /api/admin/campaigns?status=pending
GET /api/admin/users
GET /api/admin/withdrawals
PUT /api/admin/campaigns/:id/verify
PUT /api/admin/campaigns/:id/reject
POST /api/admin/withdrawals/:id/approve
```

---

## 9. Database Models & Relationships

### User Model (`server/models/user.js`)
```javascript
User {
  id: INTEGER (PK, auto-increment)
  name: STRING (not null)
  email: STRING (unique, not null)
  password: STRING (bcrypt hashed, not null)
}

Hooks:
  beforeCreate: Hash password with bcrypt.genSalt(10)

Relations:
  hasMany(Campaign) - fundraiser → created campaigns
  hasMany(Donation) - user → donations made
  hasMany(Comment) - user → comments left
```

### Campaign Model (`server/models/campaign.js`)
```javascript
Campaign {
  id: INTEGER (PK, auto-increment)
  title: STRING (required)
  description: TEXT
  goal: DECIMAL (fundraising target)
  collected: DECIMAL (default: 0)
  creatorEmail: STRING
  organizer: STRING
  location: STRING
  category: STRING
  image: TEXT (base64 encoded)
  status: STRING (default: 'pending') → 'pending'|'verified'|'rejected'
  daysLeft: INTEGER (default: 30)
  fullDescription: TEXT
}

Relations:
  belongsTo(User, FK: userId)
  hasMany(Donation)
  hasMany(Comment)
  belongsToMany(Category) via CampaignCategory join table
```

### Donation Model (see section 5)

### Comment Model (`server/models/comment.js`)
```javascript
Comment {
  id: INTEGER (PK)
  content: TEXT (required)
}

Relations:
  belongsTo(Campaign, FK: campaignId)
  belongsTo(User, FK: userId)
```

### Category Model (`server/models/category.js`)
```javascript
Category {
  id: INTEGER (PK)
  name: STRING (unique, required)
}

Relations:
  belongsToMany(Campaign) via CampaignCategory
```

### CampaignCategory (Join Table)
```javascript
CampaignCategory {
  CampaignId: INTEGER (FK)
  CategoryId: INTEGER (FK)
}
```

### Database Initialization
```javascript
sequelize.sync({ alter: true })
- Runs on server startup
- Creates/updates all tables
- alter: true modifies columns if schema changes
```

---

## 10. Key Features & Implementation Status

| Feature | Status | Details |
|---------|--------|---------|
| User Registration | ✅ Complete | Bcrypt password hashing |
| User Login | ✅ Complete | JWT tokens, optionalAuth middleware |
| Campaign Creation | ✅ Complete | Base64 image upload, pending status |
| Campaign Editing | ✅ Complete | Creator-only, real-time updates |
| Admin Campaign Verification | ✅ Component | Backend endpoints TODO |
| Donation/Payment | ✅ Complete | Midtrans integration, demo mode support |
| Pending Payment Resume | ✅ Complete | localStorage tracking |
| Donor List/Transparency | ✅ Complete | Per-campaign donation history |
| Withdrawal Requests | ✅ Component | Backend TODO |
| Chatbot | ✅ Complete | Rule-based responses, no backend |
| Recurring Donations | ⏳ Model | Data model ready, UI/backend pending |
| Email Notifications | ⏳ Planned | No implementation yet |
| Campaign Search/Filter | ⏳ Planned | Candidates filter by category, location |
| Comment System | ⏳ Model | Model exists, UI not implemented |
| Social Sharing | ⏳ Planned | Share buttons TODO |
| Mobile Responsiveness | ✅ Complete | Tailwind breakpoints applied |

---

## 11. Data Flow Examples

### Campaign Creation Flow
```
User fills form in CreateCampaign.tsx
    ↓
handleSubmit validates data
    ↓
Image converted to Base64
    ↓
POST /api/campaigns with full payload
    ↓
Backend: Campaign.create() → DB
    ↓
Response: { id, title, image, ... }
    ↓
App state updated with new campaign
    ↓
User navigated to campaign detail page
    ↓
Alert: "Kampanye berhasil dibuat dan menunggu verifikasi admin."
```

### Donation Payment Flow
```
User clicks "Donasi Sekarang" in CampaignDetail
    ↓
PaymentModal opens (step: 'identity')
    ↓
User enters name, email, anonymous toggle
    ↓
Proceeds to amount step
    ↓
Enters donation amount (min Rp 10,000)
    ↓
Proceeds to payment step
    ↓
Selects payment method (e-wallet, virtual account, etc.)
    ↓
POST /api/payments/create-intent → Backend
    ↓
Backend creates Donation record (status: 'pending')
    ↓
Midtrans snap.createTransaction() generates token
    ↓
Response: { transactionToken, donationId, orderId }
    ↓
Client: window.snap.pay(token) opens Snap popup
    ↓
User completes payment in Snap UI
    ↓
onSuccess callback:
  - POST /api/payments/confirm
  - Campaign.collected incremented
  - Donation status → 'succeeded'
  - Modal → success step
    ↓
User sees confirmation
```

### Campaign Verification Flow (Current)
```
Admin navigates to Admin Dashboard
    ↓
Sees "Kampanye Menunggu Verifikasi" section
    ↓
Lists all campaigns with status: 'pending'
    ↓
Admin clicks "Verifikasi" button
    ↓
App state: campaign.status = 'verified'
    ↓
UI refreshes, campaign moved to verified section
    ↓
(Backend: Not yet implemented)
```

---

## 12. Security Considerations

### Current Strengths
- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ JWT token-based stateless auth
- ✅ CORS protection configured
- ✅ Security headers (X-Frame-Options, CSP-ready)
- ✅ Optional authentication middleware

### Security Gaps
- ⚠️ Frontend plaintext password comparison (LoginRegister.tsx)
- ⚠️ localStorage stores user credentials
- ⚠️ No CSRF token protection
- ⚠️ Base64 images in DB (no file validation)
- ⚠️ Admin dashboard accessible without proper auth
- ⚠️ No rate limiting on payment/donation endpoints
- ⚠️ JWT secret in code: `'change_me'` default

### Recommendations
1. Always use backend login (never compare plaintext)
2. Store JWT in httpOnly cookies (not localStorage)
3. Add CSRF tokens to state-changing requests
4. Validate image MIME types & file sizes server-side
5. Implement robust admin role-based access control
6. Add rate limiting middleware (express-rate-limit)
7. Use strong JWT_SECRET from environment variables
8. Hash sensitive data in logs
9. Add input sanitization (XSS prevention)
10. Implement request validation schema (Joi, yup)

---

## 13. Environment Configuration

### Frontend (`src/app/App.tsx` references)
```javascript
VITE_API_URL = 'http://localhost:4000' (default)
VITE_MIDTRANS_CLIENT_KEY = '' (from env)
VITE_MIDTRANS_IS_PRODUCTION = 'false' (sandbox by default)
```

### Backend (`server/`)
```javascript
DATABASE_URL = 'postgres://postgres:password@localhost:5432/microcrowd'
JWT_SECRET = 'change_me' (default)
PORT = 4000 (default)
NODE_ENV = 'development' | 'production'
CORS_ORIGIN = specific origin in production
TRUST_PROXY = '0' | '1'

Midtrans:
  MIDTRANS_IS_PRODUCTION = 'false' (sandbox)
  MIDTRANS_SERVER_KEY = 'SB-Mid-server-xxxxx'
  MIDTRANS_CLIENT_KEY = 'SB-Mid-client-xxxxx'

Payment:
  PAYMENT_DEMO = 'false' (enable demo mode)
```

---

## 14. Performance & Scalability Notes

### Current Limitations
- Base64 images increase payload ~33% vs binary
- No image CDN/caching strategy
- All campaigns loaded synchronously (no pagination)
- localStorage limited to ~5-10MB per domain
- No database indexes on query fields
- No caching layer (Redis, etc.)

### Optimization Opportunities
1. Implement pagination: `GET /campaigns?page=1&limit=20`
2. Add database indexes on: `status`, `createdAt`, `category`
3. Use external image service: AWS S3, Cloudinary, etc.
4. Implement campaign caching with Redis
5. Add query pagination in CampaignDetail.tsx
6. Lazy-load donor list (only show recent 5)
7. Compress images before upload
8. Implement virtual scrolling for campaign lists

---

## 15. Code Quality & Testing

### Current State
- ✅ TypeScript for type safety
- ✅ Component-based architecture
- ✅ Separation of concerns (UI/business logic)
- ⚠️ No unit tests
- ⚠️ No integration tests
- ⚠️ No error boundary components
- ⚠️ Minimal input validation
- ⚠️ Console.error used but no logging service

### Recommended Improvements
1. Add Jest + React Testing Library
2. Implement unit tests for models
3. Add integration tests for payment flow
4. Create error boundary component
5. Implement Zod or Yup for validation
6. Add Winston/Pino for structured logging
7. Set up ESLint + Prettier
8. Add pre-commit hooks (Husky)
9. Implement CI/CD pipeline

---

## 16. Quick Start Commands

### Frontend
```bash
npm install
npm run dev      # Start dev server (Vite)
npm run build    # Production build
npm run dev:all  # Run frontend + backend together
```

### Backend
```bash
cd server
npm install
npm run dev      # Start with nodemon (auto-reload)
npm run start    # Production start
npm run seed:db  # Sync database schema
```

### Database Setup
```bash
# Update DATABASE_URL in .env to point to PostgreSQL
npm run seed:db  # Creates/updates tables
```

---

## Summary

This is a **medium-complexity crowdfunding platform** with:
- ✅ User authentication (JWT + localStorage)
- ✅ Campaign CRUD operations
- ✅ Midtrans payment integration
- ✅ Admin verification system
- ✅ Donation tracking
- ✅ Basic chatbot
- ⏳ Withdrawal system (partially implemented)
- ⏳ Full admin backend endpoints

**Primary opportunities for improvement:**
1. Complete backend admin endpoints
2. Implement email notifications
3. Add proper image storage (not Base64)
4. Secure admin authentication
5. Add comprehensive testing
6. Implement withdrawal flow
7. Add campaign search/filtering
8. Enhance chatbot with NLP

