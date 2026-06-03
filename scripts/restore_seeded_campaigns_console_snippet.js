/*
Run this in the browser console on the app (http://localhost:5173 or deployed URL)
Paste the code below and press Enter — it will restore seeded campaigns (IDs 1..6)
*/
(function restoreSeededCampaigns(){
  const seeded = [
    {
      id: 1,
      createdAt: 1711238400000,
      title: 'Warung Makan Bu Siti Terdampak Banjir',
      description: 'Warung makan yang menjadi sumber penghidupan keluarga rusak akibat banjir. Butuh bantuan untuk renovasi dan pembelian peralatan baru.',
      fullDescription: 'Warung makan Bu Siti yang sudah berdiri 15 tahun di Kampung Melayu menjadi sumber penghidupan keluarga',
      image: 'https://images.unsplash.com/photo-1767678384957-7ba885ab06d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Jakarta Timur',
      target: 15000000,
      collected: 8500000,
      donors: 143,
      daysLeft: 25,
      category: 'UMKM Terdampak Bencana',
      organizer: 'Karang Taruna Jakarta Timur',
      donations: [],
      story: '',
      fundAllocation: [
        { name: 'Renovasi', value: 4000000, color: '#10B981' },
        { name: 'Peralatan Dapur', value: 5000000, color: '#3B82F6' },
        { name: 'Kulkas & Freezer', value: 4000000, color: '#F59E0B' },
        { name: 'Modal Bahan', value: 2000000, color: '#EF4444' }
      ],
      disbursementHistory: [
        { date: '25 Mar', amount: 3000000, purpose: 'Pencairan Tahap 1: Renovasi Awal' },
        { date: '1 Apr', amount: 2500000, purpose: 'Pembelian Peralatan Dapur' },
        { date: '10 Apr', amount: 3000000, purpose: 'Pembelian Kulkas & Freezer' }
      ]
    },
    {
      id: 2,
      createdAt: 1712620800000,
      title: 'Pedagang Pasar Kebakaran Butuh Modal Usaha',
      description: 'Puluhan pedagang pasar kehilangan dagangan akibat kebakaran. Butuh bantuan modal untuk memulai usaha kembali.',
      fullDescription: 'Kebakaran hebat di Pasar Minggu menghanguskan 45 kios pedagang',
      image: 'https://images.unsplash.com/photo-1774370793502-85098cd3fd00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Jakarta Selatan',
      target: 50000000,
      collected: 32500000,
      donors: 287,
      daysLeft: 18,
      category: 'UMKM Terdampak Bencana',
      organizer: 'Paguyuban Pedagang Pasar Minggu',
      donations: [],
      story: '',
      fundAllocation: [
        { name: 'Modal Dagangan', value: 30000000, color: '#10B981' },
        { name: 'Sewa Kios', value: 15000000, color: '#3B82F6' },
        { name: 'Peralatan', value: 5000000, color: '#F59E0B' }
      ],
      disbursementHistory: [
        { date: '8 Apr', amount: 10000000, purpose: 'Pencairan Tahap 1: Modal untuk 10 pedagang' },
        { date: '15 Apr', amount: 12500000, purpose: 'Pencairan Tahap 2: Modal untuk 12 pedagang' },
        { date: '22 Apr', amount: 10000000, purpose: 'Pencairan Tahap 3: Sewa kios sementara' }
      ]
    },
    {
      id: 3,
      createdAt: 1714012800000,
      title: 'Tukang Sate Pak Joko Kehilangan Gerobak',
      description: 'Gerobak sate yang menjadi sumber penghidupan hilang dicuri. Butuh bantuan untuk membeli gerobak dan peralatan baru.',
      fullDescription: 'Pak Joko kehilangan gerobak sate yang menjadi sumber penghidupan',
      image: 'https://images.unsplash.com/photo-1762592957827-99db60cfd0c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMG1hcmtldCUyMGZvb2QlMjB2ZW5kb3J8ZW58MXx8fHwxNzc3NTMyOTM3fDA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Bandung',
      target: 8000000,
      collected: 6200000,
      donors: 98,
      daysLeft: 12,
      category: 'UMKM Terdampak Bencana',
      organizer: 'Komunitas Pedagang Kaki Lima Bandung',
      donations: [],
      story: '',
      fundAllocation: [
        { name: 'Gerobak Baru', value: 4000000, color: '#10B981' },
        { name: 'Kompor & Gas', value: 1500000, color: '#3B82F6' },
        { name: 'Peralatan', value: 1500000, color: '#F59E0B' },
        { name: 'Modal Bahan', value: 1000000, color: '#EF4444' }
      ],
      disbursementHistory: [
        { date: '28 Mar', amount: 2500000, purpose: 'Pencairan Tahap 1: DP Gerobak' },
        { date: '5 Apr', amount: 2200000, purpose: 'Pelunasan Gerobak & Kompor' },
        { date: '12 Apr', amount: 1500000, purpose: 'Pembelian Peralatan' }
      ]
    },
    {
      id: 4,
      createdAt: 1715308800000,
      title: 'Penjahit Rumahan Ibu Ani Alat Rusak',
      description: 'Mesin jahit yang digunakan untuk menerima orderan rusak. Butuh bantuan untuk membeli mesin jahit baru agar bisa melanjutkan usaha.',
      fullDescription: 'Ibu Ani kehilangan sumber penghasilan karena mesin jahit rusak',
      image: 'https://images.unsplash.com/photo-1768637758036-9a690925ae72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Surabaya',
      target: 6000000,
      collected: 3800000,
      donors: 76,
      daysLeft: 20,
      category: 'UMKM Terdampak Bencana',
      organizer: 'Yayasan UMKM Surabaya',
      donations: [],
      story: '',
      fundAllocation: [
        { name: 'Mesin Jahit', value: 4000000, color: '#10B981' },
        { name: 'Mesin Obras', value: 1500000, color: '#3B82F6' },
        { name: 'Peralatan', value: 500000, color: '#F59E0B' }
      ],
      disbursementHistory: [
        { date: '2 Apr', amount: 2000000, purpose: 'Pencairan Tahap 1: DP Mesin Jahit' },
        { date: '15 Apr', amount: 1800000, purpose: 'Pelunasan Mesin Jahit & DP Obras' }
      ]
    },
    {
      id: 5,
      createdAt: 1716595200000,
      title: 'Warung Kopi Mas Budi Terdampak Longsor',
      description: 'Warung kopi di daerah wisata rusak akibat tanah longsor. Butuh bantuan untuk renovasi dan membeli peralatan baru.',
      fullDescription: 'Warung kopi yang menjadi ikon kuliner lokal rusak akibat longsor',
      image: 'https://images.unsplash.com/photo-1757763006278-d0fa5d582d0d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Bogor',
      target: 20000000,
      collected: 5400000,
      donors: 52,
      daysLeft: 30,
      category: 'UMKM Terdampak Bencana',
      organizer: 'Dinas Koperasi & UMKM Bogor',
      donations: [],
      story: '',
      fundAllocation: [
        { name: 'Renovasi Bangunan', value: 10000000, color: '#10B981' },
        { name: 'Mesin Kopi', value: 6000000, color: '#3B82F6' },
        { name: 'Furniture', value: 2500000, color: '#F59E0B' },
        { name: 'Instalasi', value: 1500000, color: '#EF4444' }
      ],
      disbursementHistory: [
        { date: '18 Apr', amount: 3000000, purpose: 'Pencairan Tahap 1: Material Renovasi' },
        { date: '25 Apr', amount: 2400000, purpose: 'Upah Tukang & Material Tambahan' }
      ]
    },
    {
      id: 6,
      createdAt: 1717891200000,
      title: 'Pedagang Sayur Bu Wati Kehilangan Motor',
      description: 'Motor yang digunakan untuk mengangkut sayuran hilang dicuri. Butuh bantuan untuk membeli motor bekas agar bisa berjualan lagi.',
      fullDescription: 'Bu Wati kehilangan motor yang digunakan untuk berjualan sayur keliling',
      image: 'https://images.unsplash.com/photo-1767678233351-9308d8220fa5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw1fHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Yogyakarta',
      target: 12000000,
      collected: 7800000,
      donors: 112,
      daysLeft: 15,
      category: 'UMKM Terdampak Bencana',
      organizer: 'Forum UMKM Yogyakarta',
      donations: [],
      story: '',
      fundAllocation: [
        { name: 'Motor Bekas', value: 8000000, color: '#10B981' },
        { name: 'Modifikasi Bak', value: 2500000, color: '#3B82F6' },
        { name: 'Perlengkapan', value: 1000000, color: '#F59E0B' },
        { name: 'Modal', value: 500000, color: '#EF4444' }
      ],
      disbursementHistory: [
        { date: '10 Apr', amount: 4000000, purpose: 'Pencairan Tahap 1: DP Motor' },
        { date: '18 Apr', amount: 3800000, purpose: 'Pelunasan Motor & Modifikasi' }
      ]
    }
  ];

  try {
    localStorage.setItem('bantusesama-campaigns', JSON.stringify(seeded));
    // also set cleanup version so app does not wipe it immediately
    localStorage.setItem('bantusesama-campaign-cleanup-version', '2026-06-01-v3');
    // trigger storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', { key: 'bantusesama-campaigns', newValue: JSON.stringify(seeded) }));
    console.log('Seeded campaigns restored (IDs 1..6). Reload the page.');
  } catch (err) {
    console.error('Failed to write to localStorage:', err);
  }
})();
