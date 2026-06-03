const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: false });
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const { sequelize } = require('./models');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const paymentRoutes = require('./routes/payments');
const chatbotRoutes = require('./routes/chatbot');
const donationRoutes = require('./routes/donations');
const recurringRoutes = require('./routes/recurring');
const tipsRoutes = require('./routes/tips');
const sponsorBannersRoutes = require('./routes/sponsor_banners');
const adminWithdrawalsRoutes = require('./routes/admin_withdrawals');
const recurringService = require('./services/recurringPaymentService');
const devRoutes = require('./routes/dev');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = String(process.env.CORS_ORIGIN || '').trim().replace(/\/+$/, '');

app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : 0);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use((req, res, next) => {
  if (!isProduction) return next();
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto && forwardedProto !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// CORS configuration
const corsOptions = {
  credentials: true
};

if (!isProduction) {
  // In development, allow localhost on any port
  corsOptions.origin = function (origin, callback) {
    // Allow direct browser navigation (no origin) and localhost/127.0.0.1
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      callback(null, true);
      return;
    }

    // Allow local network (e.g., http://192.168.x.y:5173) when explicitly enabled
    const allowLocalNet = String(process.env.ALLOW_LOCAL_NET || '').toLowerCase() === '1';
    if (allowLocalNet && /^http:\/\/192\.168\.[0-9]{1,3}\.[0-9]{1,3}(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }

    // Also allow a specific CORS origin if set in env for convenience
    try {
      const configured = String(process.env.CORS_ORIGIN || '').trim();
      if (configured && origin === configured) {
        callback(null, true);
        return;
      }
    } catch (e) {
      // ignore
    }

    callback(new Error('CORS policy violation'));
  };
} else {
  // In production, prefer a specific origin from env.
  // If CORS_ORIGIN is not configured, allow the request origin so the API
  // can still serve from alternative frontends like preprod or Vercel staging.
  corsOptions.origin = corsOrigin || true;
}

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '15mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bantu-sesama-api',
    health: '/health',
    apiBase: '/api'
  });
});

app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Bantu Sesama API aktif',
    routes: [
      '/api/auth',
      '/api/campaigns',
      '/api/payments',
      '/api/chatbot',
      '/api/donations',
      '/api/recurring',
      '/api/tips',
      '/api/sponsor-banners'
    ]
  });
});

// Simple image proxy to avoid client-side CORS/CSP issues during development.
app.get('/image-proxy', (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'missing url query parameter' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: 'invalid url' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'unsupported protocol' });
  }

  const lib = parsed.protocol === 'https:' ? require('https') : require('http');

  const upstreamReq = lib.get(url, { headers: { 'User-Agent': 'BantuSesama-Image-Proxy/1.0' } }, (upstreamRes) => {
    const statusCode = upstreamRes.statusCode || 500;
    if (statusCode >= 400) {
      res.status(statusCode).end();
      upstreamRes.resume();
      return;
    }

    const contentType = upstreamRes.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    // Allow caching for development to reduce repeated fetches
    res.setHeader('Cache-Control', 'public, max-age=86400');

    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    console.error('image-proxy upstream error', err && err.message);
    if (!res.headersSent) res.status(502).json({ error: 'upstream fetch failed' });
  });

  upstreamReq.setTimeout(15000, () => {
    upstreamReq.abort();
    if (!res.headersSent) res.status(504).end();
  });
});

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/sponsor-banners', sponsorBannersRoutes);
app.use('/api/admin/withdrawals', adminWithdrawalsRoutes);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route not found handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 4000;
const shouldSyncSchema = String(process.env.DB_SYNC || '').toLowerCase() === 'true' || (!isProduction && String(process.env.DB_SYNC || '').toLowerCase() !== 'false');

// Global cron job reference for recurring donations
let recurringCronJob = null;

/**
 * Setup cron job untuk process recurring donations
 * Runs every day at 02:00 AM (UTC) = 9:00 AM WIB
 * Format: minute hour day month dayOfWeek
 */
function setupRecurringCronJob() {
  try {
    // Run setiap hari jam 2 pagi UTC (9 pagi WIB)
    recurringCronJob = cron.schedule('0 2 * * *', async () => {
      console.log('[Cron] Starting daily recurring donation processing...');
      try {
        const result = await recurringService.processRecurringDonations();
        console.log('[Cron] Recurring donation processing completed:', result);
      } catch (err) {
        console.error('[Cron] Error processing recurring donations:', err);
      }
    });

    console.log('[Cron] Recurring donation cron job scheduled (daily at 02:00 UTC)');

    // Alternative: untuk testing, uncomment ini untuk run setiap menit
    // recurringCronJob = cron.schedule('*/1 * * * *', async () => {
    //   console.log('[Cron] Processing recurring donations...');
    //   try {
    //     const result = await recurringService.processRecurringDonations();
    //     console.log('[Cron] Result:', result);
    //   } catch (err) {
    //     console.error('[Cron] Error:', err);
    //   }
    // });
  } catch (err) {
    console.error('[Cron] Failed to setup recurring cron job:', err);
  }
}

async function start() {
  try {
    if (shouldSyncSchema) {
      try {
        await sequelize.sync({ alter: true });
      } catch (err) {
        console.error('Failed to sync DB (continuing without sync):', err && err.message ? err.message : err);
      }
    } else {
      await sequelize.authenticate();
    }

    // Setup recurring donations scheduler
    setupRecurringCronJob();

    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
  }
}

start();
