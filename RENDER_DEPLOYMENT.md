# Deployment Guide for Render.com

## Prerequisites
- Render.com account
- PostgreSQL database (Render or external)
- Frontend deployed or accessible via CORS

## Step 1: Create PostgreSQL Database on Render

1. Go to Dashboard → New → PostgreSQL
2. Give it a name (e.g., `bantu-sesama-db`)
3. Copy the **Internal Database URL** (for backend)
4. Save credentials somewhere safe

## Step 2: Create Web Service for Backend

1. Go to Dashboard → New → Web Service
2. Connect to your GitHub repository
3. Configure:
   - **Name**: `bantu-sesama-backend`
   - **Root Directory**: `server/`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter (depending on usage)

## Step 3: Set Environment Variables

Add these to your Render Web Service → Environment:

```bash
NODE_ENV=production
PORT=10000
DATABASE_URL=<your-internal-database-url-from-step-1>
DATABASE_SSL=true
CORS_ORIGIN=<your-frontend-url>
TRUST_PROXY=1
MIDTRANS_SERVER_KEY=<your-midtrans-key>
MIDTRANS_CLIENT_KEY=<your-midtrans-key>
JWT_SECRET=<generate-a-random-secret>
```

### Important:
- **DATABASE_URL**: Use the **Internal Database URL** from Render PostgreSQL for lowest latency
- **DATABASE_SSL**: Must be `true` for Render PostgreSQL
- **CORS_ORIGIN**: Set to your frontend URL (e.g., `https://your-site.vercel.app`)

## Step 4: Deploy Frontend

Deploy to Vercel, Netlify, or Render:
- Make sure `VITE_API_BASE_URL` points to your Render backend
- Example: `VITE_API_BASE_URL=https://bantu-sesama-backend.onrender.com`

## Troubleshooting Connection Timeouts

### Error: `ConnectionAcquireTimeoutError`

**Cause**: Database connection pool exhausted or timeout too short

**Solution**:
1. ✅ Already fixed in `server/models/index.js`:
   - Pool size: 5 connections
   - Acquire timeout: 30 seconds
   - Idle timeout: 10 seconds

2. If still failing:
   - Check Render PostgreSQL service is running
   - Verify `DATABASE_URL` in Render Environment variables
   - Check `DATABASE_SSL=true` is set
   - Restart the Web Service

### Error: Connection refused

**Cause**: Backend can't reach database

**Solution**:
1. Use **Internal Database URL** (not External)
2. Both services must be in the same Render workspace
3. Add database hostname to allowed hosts if using external DB

## Health Check

Test if backend is running:
```bash
curl https://bantu-sesama-backend.onrender.com/
# Expected response: {"status":"ok","service":"bantu-sesama-api",...}
```

Test campaigns endpoint:
```bash
curl https://bantu-sesama-backend.onrender.com/api/campaigns
# Expected response: JSON array of campaigns (empty array if DB not ready)
```

## Auto-Restart on Failure

Render automatically restarts services on failure. Check logs:
1. Go to Service Dashboard
2. Click "Logs" tab
3. Look for `ConnectionAcquireTimeoutError` or other errors

## Cost Optimization

- **Free tier**: Limited resources, may timeout under load
- **Starter ($7/mo)**: Recommended for production
- **Database**: Use Render PostgreSQL free tier for testing
- **Scaling**: Add more workers if needed

## Backup

Enable automatic backups in Render PostgreSQL settings.

## SSL/TLS

Render automatically provides HTTPS (SSL/TLS) for your service at `https://your-service.onrender.com`
