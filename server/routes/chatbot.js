const express = require('express');
const router = express.Router();

// Simple knowledge base
const knowledgeBase = {
  'cara donasi': {
    keywords: ['cara donasi', 'cara berdonasi', 'bagaimana donasi', 'langkah donasi'],
    response: 'Untuk berdonasi, ikuti langkah-langkah berikut:\n1. Pilih kampanye yang ingin Anda bantu\n2. Klik tombol "Donasi Sekarang"\n3. Masukkan nama dan email Anda\n4. Tentukan nominal donasi (minimal Rp 10.000)\n5. Pilih metode pembayaran (transfer bank, e-wallet, dll)\n6. Selesaikan pembayaran\n7. Donasi Anda akan diproses dan muncul di halaman Donasi Saya'
  },
  'jenis pembayaran': {
    keywords: ['pembayaran', 'metode pembayaran', 'kartu kredit', 'transfer', 'e-wallet', 'bank'],
    response: 'Kami menerima berbagai metode pembayaran:\n✅ Transfer Bank (BCA, Mandiri, BRI, BTN, dsb)\n✅ Virtual Account (tersedia untuk semua bank)\n✅ E-Wallet (GoPay, OVO, DANA, LinkAja)\n✅ Cicilan (kartu kredit tertentu)\n✅ Convenience Store (Indomaret, Alfamart)\n\nSemua metode diproses melalui Midtrans untuk keamanan maksimal.'
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

/**
 * GET /api/chatbot/response
 * Get chatbot response based on user message
 */
router.get('/response', (req, res) => {
  try {
    const { message } = req.query;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message parameter is required',
        response: 'Silakan kirim pertanyaan Anda untuk mendapatkan bantuan.'
      });
    }

    const lowerMessage = message.toLowerCase().trim();
    let response = null;
    let confidence = 0;

    // Find best matching response
    for (const [topic, data] of Object.entries(knowledgeBase)) {
      for (const keyword of data.keywords) {
        if (lowerMessage.includes(keyword)) {
          response = data.response;
          confidence = 1;
          break;
        }
      }
      if (confidence === 1) break;

      // Fuzzy matching - check for partial words
      const words = lowerMessage.split(/\s+/);
      const topicWords = topic.split(/\s+/);
      const matchCount = words.filter(word =>
        topicWords.some(topicWord => topicWord.includes(word) || word.length > 2)
      ).length;

      if (matchCount >= topicWords.length - 1) {
        response = data.response;
        confidence = 0.8;
        break;
      }
    }

    // Default response if no match found
    if (!response) {
      response = 'Maaf, saya belum memahami pertanyaan Anda dengan sempurna. 🤔\n\nSaya bisa membantu tentang:\n• Cara berdonasi\n• Membuat kampanye\n• Metode pembayaran\n• Transparansi dana\n• Keamanan platform\n• Donasi rutin\n\nSilakan rephrase pertanyaan Anda atau hubungi tim support kami.';
      confidence = 0;
    }

    res.json({
      message,
      response,
      confidence,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan pada server',
      response: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti atau hubungi support kami.'
    });
  }
});

/**
 * POST /api/chatbot/feedback
 * Save user feedback for chatbot improvement
 */
router.post('/feedback', (req, res) => {
  try {
    const { message, response, helpful } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    // In production, save to database
    console.log('Chatbot Feedback:', {
      message,
      response,
      helpful,
      timestamp: new Date().toISOString()
    });

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
