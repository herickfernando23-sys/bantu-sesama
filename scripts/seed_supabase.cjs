#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Load .env manually (same pattern as other scripts)
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx);
    const val = trimmed.slice(idx + 1);
    process.env[key] = val;
  });
}

const { sequelize, User, Campaign, Donation, Comment, Tip } = require('../server/models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connected. Seeding sample data...');

    const [user] = await User.findOrCreate({
      where: { email: 'seed@local.test' },
      defaults: { name: 'Seed User', password: 'password123' }
    });

    const sampleCampaigns = [
      {
        title: 'Warung Bu Siti - Renovasi Dapur',
        description: 'Bantu renovasi dapur dan pembelian peralatan masak untuk Warung Bu Siti.',
        fullDescription: 'Bu Siti (52 tahun) pemilik warung yang menjadi sumber penghidupan keluarga. Dana diperlukan untuk renovasi dan pengadaan peralatan baru agar usaha dapat berjalan kembali.',
        goal: 15000000,
        collected: 8500000,
        location: 'Jakarta Timur',
        category: 'UMKM Terdampak Bencana',
        organizer: 'Karang Taruna Jakarta Timur',
        image: 'https://images.unsplash.com/photo-1767678384957-7ba885ab06d6?q=80&w=1080',
        status: 'verified',
        daysLeft: 25,
        disbursementHistory: [
          { date: '25 Mar', amount: 3000000, purpose: 'Pencairan Tahap 1: Renovasi awal' },
          { date: '1 Apr', amount: 2500000, purpose: 'Pembelian peralatan dapur' },
          { date: '10 Apr', amount: 3000000, purpose: 'Pembayaran tenaga kerja renovasi' }
        ],
        seededDonations: [
          { name: 'Rafi Pratama', email: 'rafi.pratama@example.test', amount: 250000, message: 'Semoga warung Bu Siti cepat pulih.' },
          { name: 'Nadia Lestari', email: 'nadia.lestari@example.test', amount: 500000, message: 'Titip doa dari Bandung.' },
          { name: 'Komunitas Kuliner Jaktim', email: 'kuliner.jaktim@example.test', amount: 1000000, message: 'Dukungan untuk UMKM lokal.' }
        ]
      },
      {
        title: 'Modal Usaha Korban Kebakaran Pasar',
        description: 'Puluhan pedagang kehilangan barang dagangan, butuh modal awal untuk berjualan kembali.',
        fullDescription: 'Kebakaran hebat di pasar menghanguskan kios-kios. Dana akan dipakai untuk membeli stok dan perlengkapan jualan.',
        goal: 50000000,
        collected: 32500000,
        location: 'Jakarta Selatan',
        category: 'UMKM Terdampak Bencana',
        organizer: 'Paguyuban Pedagang Pasar Minggu',
        image: 'https://images.unsplash.com/photo-1774370793502-85098cd3fd00?q=80&w=1080',
        status: 'verified',
        daysLeft: 18,
        disbursementHistory: [
          { date: '8 Apr', amount: 10000000, purpose: 'Pencairan modal awal untuk 10 pedagang' },
          { date: '15 Apr', amount: 12500000, purpose: 'Pencairan modal lanjutan untuk 12 pedagang' },
          { date: '22 Apr', amount: 10000000, purpose: 'Sewa kios sementara dan pengadaan stok' }
        ],
        seededDonations: [
          { name: 'Dian Saputra', email: 'dian.saputra@example.test', amount: 300000, message: 'Semoga para pedagang segera bangkit.' },
          { name: 'Salsa Maharani', email: 'salsa.maharani@example.test', amount: 450000, message: 'Mari saling bantu sesama.' },
          { name: 'Arif Wibowo', email: 'arif.wibowo@example.test', amount: 750000, message: 'Dukungan kecil untuk usaha besar.' }
        ]
      },
      {
        title: 'Gerobak Baru untuk Pak Joko',
        description: 'Pak Joko kehilangan gerobak sate, butuh bantuan beli gerobak baru.',
        fullDescription: 'Gerobak sate adalah mata pencaharian utama Pak Joko. Bantuan akan digunakan untuk membeli gerobak dan peralatan memasak.',
        goal: 8000000,
        collected: 6200000,
        location: 'Bandung',
        category: 'UMKM Terdampak Bencana',
        organizer: 'Komunitas Pedagang Kaki Lima Bandung',
        image: 'https://images.unsplash.com/photo-1762592957827-99db60cfd0c7?q=80&w=1080',
        status: 'verified',
        daysLeft: 12,
        disbursementHistory: [
          { date: '28 Mar', amount: 2500000, purpose: 'DP gerobak sate' },
          { date: '5 Apr', amount: 2200000, purpose: 'Pembelian kompor dan peralatan' },
          { date: '12 Apr', amount: 1500000, purpose: 'Pembelian bahan baku awal' }
        ],
        seededDonations: [
          { name: 'Reno Maulana', email: 'reno.maulana@example.test', amount: 200000, message: 'Semangat terus Pak Joko.' },
          { name: 'Yuni Kartika', email: 'yuni.kartika@example.test', amount: 350000, message: 'Semoga usaha sate kembali lancar.' },
          { name: 'Bima Nugraha', email: 'bima.nugraha@example.test', amount: 500000, message: 'Dukungan untuk UMKM lokal.' }
        ]
      },
      {
        title: 'Bantuan Modal Toko Kelontong Ibu Rani',
        description: 'Ibu Rani membutuhkan modal untuk menambah stok setelah kerusakan pasokan.',
        fullDescription: 'Toko kelontong Ibu Rani melayani lingkungan kecil. Dana akan membantu menambah barang kebutuhan pokok.',
        goal: 10000000,
        collected: 2500000,
        location: 'Surabaya',
        category: 'UMKM Lokal',
        organizer: 'Komunitas Wirausaha Lokal',
        image: 'https://images.unsplash.com/photo-1526318472351-c75fcf07060a?q=80&w=1080',
        status: 'verified',
        daysLeft: 20,
        disbursementHistory: [
          { date: '2 Apr', amount: 1200000, purpose: 'Pembelian stok sembako awal' },
          { date: '12 Apr', amount: 1300000, purpose: 'Penambahan stok makanan dan minuman' }
        ],
        seededDonations: [
          { name: 'Lina Kusuma', email: 'lina.kusuma@example.test', amount: 450000, message: 'Semoga kelontong Ibu Rani makin maju.' },
          { name: 'Sari Wulandari', email: 'sari.wulandari@example.test', amount: 400000, message: 'Bantuan kecil untuk ibu rani.' }
        ]
      },
      {
        title: 'Dukungan Untuk Tukang Jahit Kecil',
        description: 'Pembelian mesin jahit dan kain untuk meningkatkan produksi.',
        fullDescription: 'Tukang jahit lokal perlu mesin dan bahan baku untuk memenuhi pesanan pelanggan.',
        goal: 6000000,
        collected: 1200000,
        location: 'Yogyakarta',
        category: 'UMKM Lokal',
        organizer: 'Yogyakarta Craft',
        image: 'https://images.unsplash.com/photo-1520975913733-5a1f8a5b2b0a?q=80&w=1080',
        status: 'verified',
        daysLeft: 30,
        disbursementHistory: [
          { date: '5 Apr', amount: 600000, purpose: 'Pembelian mesin jahit portable' },
          { date: '14 Apr', amount: 600000, purpose: 'Pembelian kain dan benang' }
        ],
        seededDonations: [
          { name: 'Putri Azzahra', email: 'putri.azzahra@example.test', amount: 200000, message: 'Semoga tukang jahit bisa kembali buka.' },
          { name: 'Dimas Prakoso', email: 'dimas.prakoso@example.test', amount: 350000, message: 'Dukungan untuk pelaku UMKM.' }
        ]
      }
    ];

    for (const sc of sampleCampaigns) {
      const [cam, created] = await Campaign.findOrCreate({ where: { title: sc.title }, defaults: {
        title: sc.title,
        description: sc.description,
        fullDescription: sc.fullDescription,
        goal: sc.goal,
        collected: sc.collected || 0,
        creatorEmail: user.email,
        organizer: sc.organizer,
        location: sc.location,
        category: sc.category,
        image: sc.image,
        status: sc.status || 'pending',
        daysLeft: sc.daysLeft || 30,
        disbursementHistory: Array.isArray(sc.disbursementHistory) ? sc.disbursementHistory : []
      }});

      if (!Array.isArray(cam.disbursementHistory) || cam.disbursementHistory.length === 0) {
        cam.disbursementHistory = Array.isArray(sc.disbursementHistory) ? sc.disbursementHistory : [];
        await cam.save();
      }

      const existingDonations = await Donation.findAll({ where: { campaignId: cam.id } });
      const seedDonations = Array.isArray(sc.seededDonations) ? sc.seededDonations : [];

      if (existingDonations.length === 0 && seedDonations.length > 0) {
        for (let i = 0; i < seedDonations.length; i++) {
          const seed = seedDonations[i];
          const amount = Number(seed.amount || 0);
          if (!Number.isFinite(amount) || amount <= 0) continue;

          await Donation.create({
            campaignId: cam.id,
            userId: user.id,
            amount,
            currency: 'IDR',
            paymentStatus: 'succeeded',
            donorName: String(seed.name || `Donor ${i + 1}`).trim(),
            donorEmail: String(seed.email || `donor${i + 1}@example.test`).trim(),
            message: String(seed.message || '').trim(),
            createdAt: new Date(Date.now() - ((seedDonations.length - i) * 2) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - ((seedDonations.length - i) * 2) * 24 * 60 * 60 * 1000)
          });
          cam.collected = (parseFloat(cam.collected) || 0) + amount;
        }
        await cam.save();
      } else if (existingDonations.length > 0) {
        const updateCandidates = existingDonations.filter((donation) => /^Donatur\s*\d+$/i.test(donation.donorName || '')).slice(0, seedDonations.length);
        for (let i = 0; i < updateCandidates.length; i++) {
          const seed = seedDonations[i];
          if (!seed) break;
          const donation = updateCandidates[i];
          donation.donorName = String(seed.name || donation.donorName).trim();
          donation.donorEmail = String(seed.email || donation.donorEmail).trim();
          donation.message = String(seed.message || donation.message).trim();
          donation.createdAt = new Date(Date.now() - ((seedDonations.length - i) * 2) * 24 * 60 * 60 * 1000);
          donation.updatedAt = donation.createdAt;
          await donation.save();
        }
      }
    }

    // Create a general comment and tip if none exist
    try {
      const anyComment = await Comment.count();
      if (!anyComment) {
        await Comment.create({ content: 'Semoga cepat terkumpul untuk membantu usaha lokal.' });
      }
    } catch (e) { console.warn('Comment seed failed:', e && e.message ? e.message : e); }

    try {
      const anyTip = await Tip.count();
      if (!anyTip) {
        await Tip.create({ userId: user.id, amount: 5000, currency: 'IDR', paymentStatus: 'succeeded', donorName: user.name, message: 'Seed tip' });
      }
    } catch (e) { console.warn('Tip seed failed:', e && e.message ? e.message : e); }

    console.log('Seeding complete. Created user id=', user.id, 'seeded campaigns=', sampleCampaigns.length);
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err && err.message ? err.message : err);
    if (err && err.parent) console.error('DB error detail:', err.parent.message || err.parent);
    process.exit(2);
  }
}

main();
