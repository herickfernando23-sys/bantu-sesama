const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sequelize } = require('./models');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const paymentRoutes = require('./routes/payments');
const chatbotRoutes = require('./routes/chatbot');
const donationRoutes = require('./routes/donations');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN;

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
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  };
} else {
  // In production, use specific origin from env
  corsOptions.origin = corsOrigin || 'https://bantu-sesama.com';
}

app.use(cors(corsOptions));
app.use(bodyParser.json());

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

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
  }
}

start();
