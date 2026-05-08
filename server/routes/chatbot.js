const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { ChatbotInteraction } = sequelize.models;
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini rate limit & retry settings (can be configured via env)
const GEMINI_RATE_LIMIT_PER_MINUTE = parseInt(process.env.GEMINI_RATE_LIMIT_PER_MINUTE) || 5;
const GEMINI_RETRY_ATTEMPTS = parseInt(process.env.GEMINI_RETRY_ATTEMPTS) || 3;
const GEMINI_RETRY_BASE_MS = parseInt(process.env.GEMINI_RETRY_BASE_MS) || 500; // initial backoff

// Simple in-memory token bucket (per-process)
let geminiTokens = GEMINI_RATE_LIMIT_PER_MINUTE;
let geminiLastRefill = Date.now();

function refillGeminiTokens() {
  const now = Date.now();
  if (now - geminiLastRefill >= 60_000) {
    geminiTokens = GEMINI_RATE_LIMIT_PER_MINUTE;
    geminiLastRefill = now;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForGeminiToken(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    refillGeminiTokens();
    if (geminiTokens > 0) {
      geminiTokens -= 1;
      return true;
    }
    // wait a short while before rechecking
    await sleep(250);
  }
  return false;
}

// Simple knowledge base
const knowledgeBase = {
  'cara donasi': {
    keywords: ['cara donasi', 'cara berdonasi', 'bagaimana donasi', 'langkah donasi'],
    response: 'Untuk berdonasi, ikuti langkah-langkah berikut:\n1. Pilih kampanye yang ingin Anda bantu\n2. Klik tombol "Donasi Sekarang"\n3. Masukkan nama dan email Anda\n4. Tentukan nominal donasi (minimal Rp 10.000)\n5. Pilih metode pembayaran (transfer bank, e-wallet, dll)\n6. Selesaikan pembayaran\n7. Donasi Anda akan diproses dan muncul di halaman Donasi Saya'
  },
  'jenis pembayaran': {
    keywords: ['pembayaran', 'metode pembayaran', 'kartu kredit', 'transfer', 'e-wallet', 'bank'],
    response: 'Kami menerima berbagai metode pembayaran:\n✅ Transfer Bank (BCA, Mandiri, BRI, BTN, dsb)\n✅ Virtual Account (tersedia untuk semua bank)\n✅ E-Wallet (GoPay, DANA, LinkAja)\n✅ Cicilan (kartu kredit tertentu)\n✅ Convenience Store (Indomaret, Alfamart)\n\nSemua metode diproses melalui Midtrans untuk keamanan maksimal.'
  },
  'transparansi': {
    keywords: ['transparansi', 'laporan dana', 'pencairan dana', 'penggunaan dana'],
    response: 'Platform BantuSesama menjamin transparansi penuh:\n✅ Setiap kampanye menampilkan alokasi dana yang detail\n✅ Riwayat pencairan dana dapat dipantau di tab "Transparansi"\n✅ Laporan verifikasi admin untuk setiap pencairan\n✅ Donasi Anda dilindungi dengan sistem escrow\n✅ Donatur dapat melihat ringkasan progres kapan saja'
  },
  'buat kampanye': {
    keywords: ['buat kampanye', 'membuat kampanye', 'mulai kampanye', 'cara buat kampanye'],
    response: 'Untuk membuat kampanye:\n1. Klik "Mulai Kampanye" di halaman utama\n2. Daftar/login dengan email dan password\n3. Isi data kampanye:\n   - Judul dan deskripsi singkat\n   - Cerita lengkap tentang kebutuhan Anda\n   - Target dana yang realistis\n   - Lokasi dan kategori\n   - Foto pendukung (opsional)\n4. Klik "Buat Kampanye"\n5. Tim admin akan verifikasi dalam 24-48 jam\n6. Kampanye yang verified akan tampil di halaman publik'
  },
  'aman': {
    keywords: ['aman', 'keamanan', 'privasi', 'keamanan data', 'proteksi'],
    response: 'Keamanan platform BantuSesama:\n✅ Semua kampanye diverifikasi oleh tim admin\n✅ Payment gateway Midtrans tersertifikasi internasional\n✅ Data pribadi Anda dilindungi dengan enkripsi\n✅ Proses donasi dijamin aman\n✅ Sistem escrow melindungi dana donatur\n✅ Laporan transparansi akurat dan terverifikasi\n✅ Kami tidak menjual data pribadi Anda'
  },
  'berapa lama verifikasi': {
    keywords: ['berapa lama', 'waktu verifikasi', 'proses verifikasi', 'kapan diverifikasi'],
    response: 'Proses verifikasi kampanye:\n⏱️ Verifikasi Admin: 24-48 jam kerja\n✅ Kampanye yang lolos verifikasi akan tampil di halaman publik\n❌ Kampanye yang ditolak akan diberitahu alasannya\n📧 Anda akan menerima notifikasi via email\n💡 Jika ada masalah, Anda bisa edit dan kirim ulang kampanye'
  },
  'donasi rutin': {
    keywords: ['donasi rutin', 'donasi berkala', 'donasi bulanan', 'donasi berulang'],
    response: 'Donasi Rutin - Fitur Premium:\n💝 Lakukan donasi berkala (mingguan, bulanan, atau tahunan)\n📌 Persyaratan: Anda harus memiliki akun dan sudah login\n⚙️ Atur otomasi donasi ke kampanye favorit\n💳 Pembayaran otomatis sesuai jadwal\n✅ Donasi Rutin Anda ditampilkan di halaman kampanye\n📊 Kelola semua donasi rutin di halaman "Donasi Saya"'
  },
  'biaya admin': {
    keywords: ['biaya', 'komisi', 'fee', 'potongan', 'biaya admin'],
    response: 'Biaya & Komisi:\n• Donasi tanpa biaya admin untuk pengguna (gratis!)\n• Biaya payment gateway: 2.9% + Rp 1.000 (Midtrans standard)\n• Komisi platform penggalang: 5% dari dana yang terkumpul\n• Dana diteruskan ke penggalang setelah dikurangi biaya\n• Perhitungan transparan di setiap pencairan'
  },
  'hubungi support': {
    keywords: ['hubungi', 'kontak', 'support', 'bantuan', 'keluhan'],
    response: 'Hubungi Tim Support Kami:\n📧 Email: support@bantusesama.id\n📞 WhatsApp: 0812-3456-7890\n⏰ Jam operasional: Senin-Jumat, 09:00-17:00 WIB\n💬 Live Chat: Tersedia di situs utama\n🤖 Anda juga bisa mengirim pertanyaan di halaman "Hubungi Kami"\n⚡ Respons rata-rata: 2-4 jam kerja'
  },
  'halo': {
    keywords: ['halo', 'hi', 'hello', 'assalamualaikum', 'permisi'],
    response: 'Halo! 👋 Selamat datang di BantuSesama.\n\nSaya adalah asisten virtual yang siap membantu Anda dengan pertanyaan tentang:\n✅ Cara berdonasi\n✅ Membuat kampanye\n✅ Metode pembayaran\n✅ Transparansi dana\n✅ Keamanan platform\n✅ Donasi rutin\n\nAda yang bisa saya bantu? Ketik pertanyaan Anda atau pilih topik di atas!'
  }
};

// Helper function to get KB response
function getKnowledgeBaseResponse(message) {
  const lowerMessage = String(message).toLowerCase().trim();
  let response = null;
  let confidence = 0;

  for (const [topic, data] of Object.entries(knowledgeBase)) {
    for (const keyword of data.keywords) {
      if (lowerMessage.includes(keyword)) {
        response = data.response;
        confidence = 1;
        return { response, confidence };
      }
    }
  }

  if (!response) {
    response = 'Maaf, saya belum memahami pertanyaan Anda dengan sempurna. 🤔\n\nSaya bisa membantu tentang:\n• Cara donasi\n• Membuat kampanye\n• Metode pembayaran\n• Transparansi dana\n• Keamanan platform\n• Donasi rutin\n• Biaya admin\n• Hubungi support\n\nSilakan rephrase pertanyaan Anda atau hubungi tim support kami.';
    confidence = 0;
  }

  return { response, confidence };
}

/**
 * GET /api/chatbot/response
 * Get chatbot response based on knowledge base only
 */
router.get('/response', (req, res) => {
  try {
    const { message } = req.query;
    const sessionId = (req.query.sessionId || req.query.session_id) ? String(req.query.sessionId || req.query.session_id) : undefined;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message parameter is required',
        response: 'Silakan kirim pertanyaan Anda untuk mendapatkan bantuan.'
      });
    }

    const { response, confidence } = getKnowledgeBaseResponse(message);

    // Persist interaction (best-effort)
    if (ChatbotInteraction) {
      ChatbotInteraction.create({ message: String(message), response: String(response), source: 'kb', sessionId }).catch(() => {});
    }

    res.json({
      message,
      response,
      confidence,
      source: 'kb',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chatbot response error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan pada server',
      response: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti atau hubungi support kami.'
    });
  }
});

/**
 * GET /api/chatbot/nlp
 * Try Gemini AI first; fall back to knowledge base if unavailable.
 */
router.get('/nlp', async (req, res) => {
  const sessionId = (req.query.sessionId || req.query.session_id) ? String(req.query.sessionId || req.query.session_id) : undefined;
  
  try {
    const { message } = req.query;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message parameter is required' });
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // Require Gemini key — do not fallback to KB when disabled
    if (!GEMINI_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
    }

    // Acquire a token before calling Gemini to respect local rate limits
    const tokenAcquired = await waitForGeminiToken(30000);
    if (!tokenAcquired) {
      return res.status(429).json({ error: 'Local rate limit exceeded. Try again later.' });
    }

    // Retry loop with exponential backoff and honoring server RetryInfo when provided
    let lastErr = null;
    for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt++) {
      try {
        const prompt = `You are a helpful assistant for a crowdfunding platform called BantuSesama. Answer user questions concisely in Indonesian. If the question is about payment methods or policies, be precise and mention limits.`;
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(`${prompt}\n\nPertanyaan user: ${String(message)}`);
        const content = result?.response?.text?.() || '';

        if (!content.trim()) throw new Error('Empty response from Gemini');

        if (ChatbotInteraction) {
          ChatbotInteraction.create({ message: String(message), response: String(content).trim(), source: 'nlp', aiModel: 'gemini-2.5-flash', sessionId }).catch(() => {});
        }

        return res.json({ message, response: String(content).trim(), confidence: 1, source: 'nlp', aiModel: 'gemini-2.5-flash' });
      } catch (geminiErr) {
        lastErr = geminiErr;
        // If the API returned RetryInfo, parse it and wait that long before retrying
        try {
          const details = geminiErr && geminiErr.errorDetails ? geminiErr.errorDetails : null;
          if (details && Array.isArray(details)) {
            const retryInfo = details.find(d => d['@type'] && String(d['@type']).includes('RetryInfo'));
            if (retryInfo && retryInfo.retryDelay) {
              // retryDelay might be a string like '41s' or an object; try to parse seconds
              const m = String(retryInfo.retryDelay).match(/(\d+(?:\.\d+)?)/);
              if (m) {
                const waitSec = Math.ceil(Number(m[1]));
                console.warn(`Gemini returned RetryInfo, waiting ${waitSec}s before retrying`);
                await sleep(waitSec * 1000);
                continue; // retry after waiting
              }
            }
          }
        } catch (parseErr) {
          // ignore parsing errors and fall through to exponential backoff
        }

        if (attempt < GEMINI_RETRY_ATTEMPTS) {
          const backoff = GEMINI_RETRY_BASE_MS * Math.pow(2, attempt - 1);
          await sleep(backoff);
          continue;
        }
      }
    }

    console.error('Gemini API error (no KB fallback):', lastErr);
    return res.status(502).json({ error: 'Gemini API error', message: lastErr && lastErr.message ? lastErr.message : String(lastErr) });
  } catch (error) {
    console.error('Chatbot NLP error:', error);
    const { response, confidence } = getKnowledgeBaseResponse(req.query.message || '');
    if (ChatbotInteraction) {
      ChatbotInteraction.create({ message: String(req.query.message || ''), response: String(response), source: 'kb', sessionId }).catch(() => {});
    }
    return res.json({ message: req.query.message || '', response, confidence, source: 'kb', timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/chatbot/feedback
 * Save user feedback for chatbot improvement
 */
router.post('/feedback', async (req, res) => {
  try {
    const { message, response, helpful, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    // Try to find recent interaction and update helpful flag
    if (ChatbotInteraction) {
      try {
        const interaction = await ChatbotInteraction.findOne({ where: { message: String(message), response: String(response || ''), sessionId: sessionId || null }, order: [['createdAt', 'DESC']] });
        if (interaction) {
          interaction.helpful = helpful === true || helpful === 'true' ? true : false;
          await interaction.save();
        } else {
          await ChatbotInteraction.create({ message: String(message), response: String(response || ''), helpful: helpful === true || helpful === 'true' ? true : false, sessionId: sessionId || null });
        }
      } catch (dbErr) {
        console.error('Failed to persist feedback:', dbErr);
      }
    }

    res.json({
      success: true,
      message: 'Terima kasih atas feedback Anda! Kami terus berusaha meningkatkan layanan.'
    });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan saat menyimpan feedback'
    });
  }
});

/**
 * GET /api/chatbot/topics
 * Get list of available chat topics
 */
router.get('/topics', (req, res) => {
  try {
    const topics = Object.keys(knowledgeBase).map(topic => ({
      topic,
      keywords: knowledgeBase[topic].keywords
    }));

    res.json({
      topics,
      totalTopics: topics.length
    });
  } catch (error) {
    console.error('Topics error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan saat mengambil daftar topik'
    });
  }
});

module.exports = router;
