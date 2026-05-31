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
        daysLeft: 25
      },
      {
        title: 'Modal Usaha Korban Kebakaran Pasar',
        description: 'Puluhan pedagang kehilangan barang dagangan, butuh modal awal untuk berjualan kembali.',
        fullDescription: 'Kebakaran hebat di pasar menghanguskan kios-kios. Dana akan dipakai untuk membeli stok dan perlengkapan jualan.',
        goal: 50000000,
        collected: 3250000,
        location: 'Jakarta Selatan',
        category: 'UMKM Terdampak Bencana',
        organizer: 'Paguyuban Pedagang Pasar Minggu',
        image: 'https://images.unsplash.com/photo-1774370793502-85098cd3fd00?q=80&w=1080',
        status: 'verified',
        daysLeft: 18
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
        daysLeft: 12
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
        daysLeft: 20
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
        daysLeft: 30
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
        daysLeft: sc.daysLeft || 30
      }});

      // create a few donations so campaign detail shows donors
      const existingDonations = await Donation.count({ where: { campaignId: cam.id } });
      if (existingDonations < 5) {
        const donorsToCreate = 5;
        for (let i = 0; i < donorsToCreate; i++) {
          const amt = Math.floor(Math.random() * 10 + 1) * 100000; // 100k..1.1M
          await Donation.create({
            campaignId: cam.id,
            userId: user.id,
            amount: amt,
            currency: 'IDR',
            paymentStatus: 'succeeded',
            donorName: `Donatur ${i+1}`,
            donorEmail: `donor${i+1}@example.test`,
            message: 'Dari seed'
          });
          cam.collected = (parseFloat(cam.collected) || 0) + amt;
        }
        await cam.save();
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
