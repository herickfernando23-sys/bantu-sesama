type InfoPageKey = Exclude<Page, 'kampanye' | 'donasi-saya' | 'cara-kerja' | 'login' | 'buat-kampanye' | 'panel' | 'admin' | 'admin-login' | 'lanjut-pembayaran' | 'home' | null>;
import { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { CampaignCard } from './components/CampaignCard';
import { CampaignDetail } from './components/CampaignDetail';
import { DonasiSaya } from './components/DonasiSaya';
import { CreateCampaign } from './components/CreateCampaign';
import { LoginRegister } from './components/LoginRegister';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { ContinuePaymentPage } from './components/ContinuePaymentPage';
import { Chatbot } from './components/Chatbot';
import { apiUrl, getApiBaseUrl } from './lib/apiBaseUrl';
import { TrendingUp, Shield, Users, Heart } from 'lucide-react';

const DEFAULT_CAMPAIGN_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 360%22%3E%3Crect width=%22640%22 height=%22360%22 fill=%22%23e5e7eb%22/%3E%3Ctext x=%22320%22 y=%22180%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%229ca3af%22 font-family=%22Arial%22 font-size=%2232%22%3ENo%20Image%3C/text%3E%3C/svg%3E';

type Page =
  | 'kampanye'
  | 'donasi-saya'
  | 'cara-kerja'
  | 'login'
  | 'buat-kampanye'
  | 'panel'
  | 'admin'
  | 'admin-login'
  | 'home'
  | 'tentang-kami'
  | 'syarat-ketentuan'
  | 'kebijakan-privasi'
  | 'faq'
  | 'hubungi-kami'
  | 'panduan-donatur'
  | 'panduan-penggalang'
  | 'lanjut-pembayaran'
  | null;

type CampaignStatus = 'verified' | 'pending' | 'rejected';

type WithdrawalStatus = 'Pending' | 'Success' | 'Rejected';

type CampaignRecord = {
  id: number;
  createdAt?: number;
  creatorEmail?: string;
  title: string;
  description: string;
  fullDescription: string;
  image: string;
  location: string;
  target: number;
  goal?: number;
  collected: number;
  donors: number;
  daysLeft: number;
  category: string;
  organizer: string;
  story: string;
  fundAllocation: Array<{ name: string; value: number; color: string }>;
  disbursementHistory: Array<{ date: string; amount: number; purpose: string }>;
  donations?: Array<{ name: string; amount: number; message: string; timestamp: number }>;
  status?: CampaignStatus;
};

type WithdrawalRequest = {
  id: number;
  campaignId: number;
  campaignTitle: string;
  requestedByName: string;
  requestedByEmail: string;
  amount: number;
  note: string;
  status: WithdrawalStatus;
  createdAt: number;
  updatedAt: number;
};

type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'pending';
  campaignCount: number;
};

type AppUser = {
  name: string;
  email?: string;
};

type StoredUser = {
  name: string;
  email: string;
  password: string;
};

type ServerUserRow = {
  id: number;
  name: string;
  email: string;
};

type PendingPaymentRecord = {
  donationId: number;
  orderId: string;
  campaignTitle: string;
  amount: number;
  tipAmount?: number;
  method: 'virtual_account' | 'ewallet';
  redirectUrl?: string;
  ownerEmail?: string;
  createdAt: number;
  updatedAt: number;
};

type RecurringDonationRecord = {
  email: string;
  campaignTitle: string;
  amount: number;
  createdAt: number;
  updatedAt: number;
};

const campaignStorageKey = 'bantusesama-campaigns';
const campaignCleanupVersionKey = 'bantusesama-campaign-cleanup-version';
const campaignCleanupVersion = '2026-06-01-v3';
const hiddenDemoCampaignIdsKey = 'bantusesama-hidden-demo-campaign-ids';
const registeredUsersKey = 'bantusesama-registered-users';
const adminSessionKey = 'bantusesama-admin-session';
const withdrawalRequestsKey = 'bantusesama-withdrawal-requests';
const pendingPaymentsKey = 'bantusesama-pending-payments';
const userSessionKey = 'bantusesama-user-session';
const recurringDonationsKey = 'bantusesama-recurring-donors';
const toSafeText = (value: unknown) => String(value ?? '').trim();
const toSafeNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};
const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();
const stripMarkdownHeading = (value: unknown) => toSafeText(value).replace(/^\s*#{1,6}\s*/gm, '').replace(/\s+/g, ' ').trim();
const normalizeKeyText = (value: unknown) => stripMarkdownHeading(value).toLowerCase();
const legacyCampaignIdMap: Record<number, number> = {
  1001: 7,
  1002: 8,
  1003: 9,
  1004: 10,
  1005: 11,
  1006: 12
};

const legacyPaginationMockTitles = new Set([
  'Baksop Ibu Lina Butuh Modal Baru',
  'Warung Nasi Pak Eko Perlu Perbaikan',
  'Tukang Jahit Bu Titin Kembali Beroperasi',
  'Pedagang Kaki Lima Butuh Gerobak Baru',
  'Ibu Rani Butuh Modal untuk Toko Kelontong',
  'Koperasi UKM Butuh Dana Operasional',
  'Warung Bu Siti - Renovasi Dapur',
  'Modal Usaha Korban Kebakaran Pasar',
  'Gerobak Baru untuk Pak Joko',
  'Bantuan Modal Toko Kelontong Ibu Rani',
  'Dukungan Untuk Tukang Jahit Kecil',
  'CCZXCC',
  'Bantuan Modal Usaha Mikro',
  'Dukungan UMKM Lokal'
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const seededDemoDonationsByCampaignId: Record<number, Array<{ name: string; amount: number; message: string; timestamp: number }>> = {
  1: [
    { name: 'Rafi Pratama', amount: 250000, message: 'Semoga warung Bu Siti cepat pulih.', timestamp: now - 5 * DAY_MS },
    { name: 'Nadia Lestari', amount: 500000, message: 'Titip doa dari Bandung.', timestamp: now - 4 * DAY_MS },
    { name: 'Komunitas Kuliner Jaktim', amount: 1000000, message: 'Dukungan untuk UMKM lokal.', timestamp: now - 3 * DAY_MS },
    { name: 'Anton Saputra', amount: 150000, message: 'Semoga renovasinya segera selesai.', timestamp: now - 2 * DAY_MS },
    { name: 'Dewi Prabowo', amount: 200000, message: 'Semoga dapur baru membawa rejeki.', timestamp: now - 1 * DAY_MS }
  ],
  2: [
    { name: 'Dian Saputra', amount: 300000, message: 'Semoga para pedagang segera bangkit.', timestamp: now - 6 * DAY_MS },
    { name: 'Salsa Maharani', amount: 450000, message: 'Bersama kita pulihkan pasar.', timestamp: now - 5 * DAY_MS },
    { name: 'Arif Wibowo', amount: 750000, message: 'Dukungan untuk pemulihan ekonomi lokal.', timestamp: now - 4 * DAY_MS },
    { name: 'Mirna Ayu', amount: 250000, message: 'Semoga kios kembali ramai.', timestamp: now - 3 * DAY_MS },
    { name: 'Fikri Hidayat', amount: 500000, message: 'Mari bantu saudara kita di pasar.', timestamp: now - 2 * DAY_MS }
  ],
  3: [
    { name: 'Reno Maulana', amount: 200000, message: 'Semangat terus Pak Joko.', timestamp: now - 7 * DAY_MS },
    { name: 'Yuni Kartika', amount: 350000, message: 'Semoga jualan sate lancar lagi.', timestamp: now - 6 * DAY_MS },
    { name: 'Bima Nugraha', amount: 500000, message: 'Dukungan untuk usaha kuliner.', timestamp: now - 5 * DAY_MS },
    { name: 'Sinta Putri', amount: 250000, message: 'Semoga gerobaknya cepat jadi.', timestamp: now - 4 * DAY_MS },
    { name: 'Indra Lesmana', amount: 300000, message: 'Agar usaha kembali menghidupi keluarga.', timestamp: now - 3 * DAY_MS }
  ],
  4: [
    { name: 'Ica Permata', amount: 150000, message: 'Semoga Ibu Ani segera bisa terima order lagi.', timestamp: now - 7 * DAY_MS },
    { name: 'Tegar Ananda', amount: 300000, message: 'Semoga usaha jahitnya makin maju.', timestamp: now - 6 * DAY_MS },
    { name: 'Lina Kusuma', amount: 450000, message: 'Dukungan untuk penjahit rumahan.', timestamp: now - 5 * DAY_MS },
    { name: 'Maya Sari', amount: 200000, message: 'Agar bisa beli kain dan benang lagi.', timestamp: now - 4 * DAY_MS },
    { name: 'Luki Ramadhan', amount: 250000, message: 'Semoga orderan segera datang lagi.', timestamp: now - 2 * DAY_MS }
  ],
  5: [
    { name: 'Fajar Rahman', amount: 250000, message: 'Semoga warung kopi cepat buka kembali.', timestamp: now - 6 * DAY_MS },
    { name: 'Wulan Sari', amount: 400000, message: 'Dukungan untuk Mas Budi.', timestamp: now - 5 * DAY_MS },
    { name: 'Yoga Firmansyah', amount: 600000, message: 'Semoga kedai kopi kembali ramai.', timestamp: now - 4 * DAY_MS },
    { name: 'Bayu Pratama', amount: 300000, message: 'Bantuan kecil, harapan besar.', timestamp: now - 3 * DAY_MS },
    { name: 'Sari Dewi', amount: 350000, message: 'Agar usaha kopi tetap bertahan.', timestamp: now - 2 * DAY_MS }
  ],
  6: [
    { name: 'Putri Azzahra', amount: 200000, message: 'Semoga Bu Wati segera bisa jualan lagi.', timestamp: now - 6 * DAY_MS },
    { name: 'Dimas Prakoso', amount: 350000, message: 'Dukungan untuk pelaku UMKM.', timestamp: now - 5 * DAY_MS },
    { name: 'Naufal Hadi', amount: 500000, message: 'Semoga lancar rezekinya.', timestamp: now - 4 * DAY_MS },
    { name: 'Rina Kartini', amount: 250000, message: 'Semoga penjualan kembali stabil.', timestamp: now - 3 * DAY_MS },
    { name: 'Adi Santoso', amount: 300000, message: 'Agar donasi cepat sampai ke Bu Wati.', timestamp: now - 2 * DAY_MS }
  ]
};

const seededDemoDonationsByCampaignTitle: Record<string, Array<{ name: string; amount: number; message: string; timestamp: number }>> = {
  'warung bu siti - renovasi dapur': seededDemoDonationsByCampaignId[1],
  'modal usaha korban kebakaran pasar': seededDemoDonationsByCampaignId[2],
  'gerobak baru untuk pak joko': seededDemoDonationsByCampaignId[3],
  'bantuan modal toko kelontong ibu rani': seededDemoDonationsByCampaignId[4],
  'dukungan untuk tukang jahit kecil': seededDemoDonationsByCampaignId[5],
  'dukungan umkm lokal': seededDemoDonationsByCampaignId[6],
  'warung makan bu siti terdampak banjir': seededDemoDonationsByCampaignId[1],
  'pedagang pasar kebakaran butuh modal usaha': seededDemoDonationsByCampaignId[2],
  'tukang sate pak joko kehilangan gerobak': seededDemoDonationsByCampaignId[3],
  'penjahit rumahan ibu ani alat rusak': seededDemoDonationsByCampaignId[4],
  'warung kopi mas budi terdampak longsor': seededDemoDonationsByCampaignId[5],
  'pedagang sayur bu wati kehilangan motor': seededDemoDonationsByCampaignId[6]
};

const loadRegisteredUsersFromStorage = () => {
  if (typeof window === 'undefined') {
    return [] as StoredUser[];
  }

  try {
    const raw = window.localStorage.getItem(registeredUsersKey);
    const parsed = raw ? (JSON.parse(raw) as StoredUser[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as StoredUser[];
  }
};

const loadAdminSessionFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(adminSessionKey);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
};

const loadUserSessionFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(userSessionKey);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
};

const saveUserSessionToStorage = (user: AppUser | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (user) {
    window.localStorage.setItem(userSessionKey, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(userSessionKey);
  }
};

const loadWithdrawalRequestsFromStorage = () => {
  if (typeof window === 'undefined') {
    return [] as WithdrawalRequest[];
  }

  try {
    const raw = window.localStorage.getItem(withdrawalRequestsKey);
    const parsed = raw ? (JSON.parse(raw) as WithdrawalRequest[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as WithdrawalRequest[];
  }
};

const loadPendingPaymentsFromStorage = () => {
  if (typeof window === 'undefined') {
    return [] as PendingPaymentRecord[];
  }

  try {
    const raw = window.localStorage.getItem(pendingPaymentsKey);
    const parsed = raw ? (JSON.parse(raw) as PendingPaymentRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as PendingPaymentRecord[];
  }
};

const loadRecurringDonationsFromStorage = () => {
  if (typeof window === 'undefined') {
    return [] as RecurringDonationRecord[];
  }

  try {
    const raw = window.localStorage.getItem(recurringDonationsKey);
    const parsed = raw ? (JSON.parse(raw) as RecurringDonationRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as RecurringDonationRecord[];
  }
};

const loadHiddenDemoCampaignIdsFromStorage = () => {
  if (typeof window === 'undefined') {
    return [] as number[];
  }

  try {
    const raw = window.localStorage.getItem(hiddenDemoCampaignIdsKey);
    const parsed = raw ? (JSON.parse(raw) as number[]) : [];
    // Only keep legacy/mock campaign IDs in high numeric range.
    // Real campaigns (including seeded 1..6) must never be hidden by this flag.
    return Array.isArray(parsed)
      ? parsed.filter((id) => Number.isFinite(id) && id >= 1000)
      : [];
  } catch {
    return [] as number[];
  }
};

const saveHiddenDemoCampaignIdsToStorage = (ids: number[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(hiddenDemoCampaignIdsKey, JSON.stringify(ids));
  } catch {
    // ignore write failures
  }
};

const getRecurringDonationForEmail = (email?: string | null) => {
  if (!email) {
    return null;
  }

  return loadRecurringDonationsFromStorage().find((record) => record.email.toLowerCase() === email.toLowerCase()) ?? null;
};

const buildCampaignFingerprint = (campaign: CampaignRecord) => [
  normalizeKeyText(campaign.title),
  normalizeKeyText(campaign.location),
  normalizeKeyText(campaign.creatorEmail),
  normalizeKeyText(campaign.organizer),
  normalizeKeyText(campaign.category),
].join('|');

const migrateLegacyCampaignId = (campaign: CampaignRecord): CampaignRecord => {
  const nextId = legacyCampaignIdMap[campaign.id];
  return nextId ? { ...campaign, id: nextId } : campaign;
};

const campaignStatusRank: Record<CampaignStatus, number> = {
  verified: 3,
  rejected: 2,
  pending: 1
};

const dedupeCampaigns = (campaigns: CampaignRecord[]) => {
  const byFingerprint = new Map<string, CampaignRecord>();

  campaigns.forEach((campaign) => {
    const fingerprint = buildCampaignFingerprint(campaign);
    const existing = byFingerprint.get(fingerprint);
    if (!existing) {
      byFingerprint.set(fingerprint, campaign);
      return;
    }

    // If the same campaign ID appears in both local and remote data, preserve the
    // version with the higher collected/donors values, because local updates may
    // already contain new donations that are not yet reflected in the backend.
    if (existing.id && campaign.id && existing.id === campaign.id) {
      const existingCollected = toSafeNumber(existing.collected, 0);
      const nextCollected = toSafeNumber(campaign.collected, 0);
      const existingDonors = toSafeNumber(existing.donors, 0);
      const nextDonors = toSafeNumber(campaign.donors, 0);
      if (nextCollected > existingCollected || nextDonors > existingDonors) {
        byFingerprint.set(fingerprint, campaign);
      }
      return;
    }

    const existingTarget = toSafeNumber(existing.target, 0);
    const nextTarget = toSafeNumber(campaign.target, 0);
    const existingCollected = toSafeNumber(existing.collected, 0);
    const nextCollected = toSafeNumber(campaign.collected, 0);
    const existingStatusScore = campaignStatusRank[(existing.status ?? 'pending') as CampaignStatus] ?? 0;
    const nextStatusScore = campaignStatusRank[(campaign.status ?? 'pending') as CampaignStatus] ?? 0;
    const existingScore = (existingStatusScore * 1_000_000_000) + existingTarget + existingCollected + (existing.createdAt ?? 0);
    const nextScore = (nextStatusScore * 1_000_000_000) + nextTarget + nextCollected + (campaign.createdAt ?? 0);

    if (nextScore > existingScore) {
      byFingerprint.set(fingerprint, campaign);
    }
  });

  return Array.from(byFingerprint.values());
};

const normalizeCampaignRecord = (campaign: CampaignRecord): CampaignRecord => {
  const rawTarget = toSafeNumber((campaign as CampaignRecord & { target?: number | string }).target, 0);
  const rawGoal = toSafeNumber((campaign as CampaignRecord & { goal?: number | string }).goal, 0);
  const normalizedDonations = Array.isArray(campaign.donations) ? campaign.donations : [];
  const hasExplicitDonorCount = campaign.donors !== undefined && campaign.donors !== null;
  
  let normalizedTarget = Math.max(0, rawTarget > 0 ? rawTarget : rawGoal);
  if (normalizedTarget === 0) {
    normalizedTarget = 5000000; // Default 5M for any campaign with missing target/goal
  }
  
  const normalizedCollected = Math.max(0, toSafeNumber(campaign.collected, 0));
  const normalizedDonors = Math.max(0, toSafeNumber(campaign.donors, 0));
  const derivedDonors = normalizedDonations.length > 0 ? normalizedDonations.length : normalizedDonors;
  const finalDonors = hasExplicitDonorCount
    ? Math.max(normalizedDonors, normalizedDonations.length)
    : derivedDonors;
  const isSeedDemoCampaign = Number.isFinite(campaign.id) && campaign.id > 0 && campaign.id <= 6;

  const migratedCampaign = migrateLegacyCampaignId(campaign);
  const normalizedId = Number(migratedCampaign.id);
  const normalizedTitleKey = stripMarkdownHeading(migratedCampaign.title).toLowerCase().trim();
  const seededDonations = seededDemoDonationsByCampaignId[normalizedId]
    || seededDemoDonationsByCampaignTitle[normalizedTitleKey]
    || [];
  const effectiveDonations = normalizedDonations.length > 0
    ? normalizedDonations
    : seededDonations.map((donation) => ({ ...donation }));
  const donationTotal = effectiveDonations.reduce((sum, donation) => sum + Number(donation?.amount || 0), 0);
  const correctedCollected = hasExplicitDonorCount && finalDonors === 0 && normalizedCollected > 0 && !isSeedDemoCampaign
    ? 0
    : (normalizedCollected > 0 ? normalizedCollected : donationTotal);

  const baseStatus = (campaign.status ?? 'pending') as CampaignStatus;
  const hasFundraisingProgress = correctedCollected > 0 || finalDonors > 0;
  const inferredStatus: CampaignStatus = baseStatus === 'rejected'
    ? 'rejected'
    : (Number.isFinite(campaign.id) && campaign.id > 0 && campaign.id <= 6)
      ? 'verified'
      : hasFundraisingProgress
        ? 'verified'
        : baseStatus;

  return ({
  ...migratedCampaign,
  id: Number.isFinite(normalizedId) && normalizedId > 0 ? normalizedId : 0,
  createdAt: campaign.createdAt ?? Date.now(),
  title: stripMarkdownHeading(campaign.title),
  description: stripMarkdownHeading(campaign.description),
  fullDescription: toSafeText(campaign.fullDescription || campaign.story || campaign.description),
  story: toSafeText(campaign.story || campaign.fullDescription || campaign.description),
  image: campaign.image || DEFAULT_CAMPAIGN_IMAGE,
  location: toSafeText(campaign.location),
  category: toSafeText(campaign.category),
  organizer: toSafeText(campaign.organizer),
  creatorEmail: toSafeText(campaign.creatorEmail),
  goal: rawGoal,
  target: normalizedTarget,
  collected: correctedCollected,
  donors: finalDonors,
  daysLeft: Math.max(0, toSafeNumber(campaign.daysLeft, 0)),
  status: inferredStatus,
  fundAllocation: Array.isArray(campaign.fundAllocation) ? campaign.fundAllocation : [],
  disbursementHistory: Array.isArray(campaign.disbursementHistory) ? campaign.disbursementHistory : [],
  donations: normalizedDonations.length > 0
    ? normalizedDonations
    : seededDonations.map((donation) => ({ ...donation }))
});
};

const isRenderableCampaign = (campaign: CampaignRecord) => {
  const title = toSafeText(campaign.title);
  const description = toSafeText(campaign.description || campaign.fullDescription || campaign.story);
  const location = toSafeText(campaign.location);
  const organizer = toSafeText(campaign.organizer);
  const target = Math.max(0, toSafeNumber(campaign.target, 0));

  return (
    title.length >= 4
    && description.length >= 10
    && location.length >= 2
    && organizer.length >= 2
    && target >= 100000
  );
};

const infoPageContent: Record<InfoPageKey, { eyebrow: string; title: string; description: string; points: string[] }> = {
  'tentang-kami': {
    eyebrow: 'Tentang BantuSesama',
    title: 'Platform crowdfunding untuk UMKM yang terdampak bencana',
    description: 'BantuSesama mempertemukan donatur dengan pelaku UMKM yang butuh bantuan cepat, transparan, dan mudah dipantau.',
    points: [
      'Dana dicatat secara transparan dari penggalangan sampai pencairan.',
      'Kampanye yang tampil di halaman publik melewati proses verifikasi.',
      'Riwayat penggunaan dana bisa dipantau langsung di dashboard kampanye.'
    ]
  },
  'syarat-ketentuan': {
    eyebrow: 'Aturan Layanan',
    title: 'Syarat dan ketentuan penggunaan platform',
    description: 'Halaman ini menjelaskan tanggung jawab pengguna, kebijakan kampanye, dan batasan layanan.',
    points: [
      'Pengguna wajib memberikan data yang benar saat mendaftar atau membuat kampanye.',
      'Setiap kampanye dapat ditinjau atau ditolak jika tidak memenuhi kebijakan platform.',
      'Kami dapat memperbarui ketentuan ini saat layanan berkembang.'
    ]
  },
  'kebijakan-privasi': {
    eyebrow: 'Privasi',
    title: 'Cara kami mengelola data pribadi',
    description: 'Kami hanya menggunakan data untuk menjalankan layanan, memproses donasi, dan menjaga keamanan akun.',
    points: [
      'Data akun dipakai untuk otentikasi dan riwayat aktivitas.',
      'Informasi donatur dipakai untuk bukti transaksi dan notifikasi layanan.',
      'Kami tidak menjual data pribadi pengguna kepada pihak lain.'
    ]
  },
  faq: {
    eyebrow: 'Bantuan Cepat',
    title: 'Pertanyaan yang sering diajukan',
    description: 'Ringkasan singkat untuk pertanyaan umum tentang donasi, kampanye, dan pencairan dana.',
    points: [
      'Apakah donasi bisa dipantau? Ya, setiap kampanye punya ringkasan progres dan pencairan.',
      'Siapa yang bisa membuat kampanye? Pengguna yang sudah login dan memenuhi syarat platform.',
      'Bagaimana kalau butuh bantuan? Gunakan halaman Hubungi Kami untuk mengirim pertanyaan.'
    ]
  },
  'hubungi-kami': {
    eyebrow: 'Kontak',
    title: 'Hubungi tim BantuSesama',
    description: 'Gunakan kanal berikut jika butuh bantuan terkait kampanye, donasi, atau verifikasi akun.',
    points: [
      'Email: info@bantusesama.id',
      'WhatsApp: 0812-3456-7890',
      'Jam respons: Senin sampai Jumat, 09.00 - 17.00 WIB'
    ]
  },
  'panduan-donatur': {
    eyebrow: 'Panduan Donatur',
    title: 'Langkah singkat untuk mulai berdonasi',
    description: 'Panduan ini membantu donatur baru menyelesaikan transaksi dengan aman dan jelas.',
    points: [
      'Pilih kampanye yang ingin dibantu dari halaman utama.',
      'Isi nama, email, dan nominal donasi sebelum lanjut ke pembayaran.',
      'Pantau status donasi di halaman Donasi Saya setelah login.'
    ]
  },
  'panduan-penggalang': {
    eyebrow: 'Panduan Penggalang',
    title: 'Cara membuat kampanye yang lebih siap diverifikasi',
    description: 'Gunakan panduan ini agar kampanye Anda lebih lengkap sebelum dikirim ke tim verifikasi.',
    points: [
      'Tulis judul, deskripsi, dan cerita lengkap yang jelas dan jujur.',
      'Cantumkan target dana dan lokasi yang realistis.',
      'Tambahkan foto pendukung agar kampanye lebih meyakinkan.'
    ]
  }
};

function InfoPage({ page, onNavigate, onHome }: { page: InfoPageKey; onNavigate: (nextPage: string) => void; onHome: () => void; }) {
  const content = infoPageContent[page];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onNavigate={onNavigate} onHome={onHome} />
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white shadow-sm border border-gray-200 p-8 md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-4">{content.eyebrow}</p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{content.title}</h1>
            <p className="text-gray-600 text-lg mb-8">{content.description}</p>
            <div className="grid md:grid-cols-3 gap-4">
              {content.points.map((point) => (
                <div key={point} className="rounded-2xl bg-blue-50 border border-blue-100 p-5 text-gray-700">
                  {point}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onHome} className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Kembali ke Beranda
              </button>
              <button onClick={() => onNavigate('kampanye')} className="px-5 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium text-gray-700">
                Lihat Kampanye
              </button>
            </div>
          </div>
        </div>
      </section>
      <Chatbot />
    </div>
  );
}

export default function App() {
  const persistedAdminUser = loadAdminSessionFromStorage();
  const persistedUser = loadUserSessionFromStorage();
  const initialPage: Page = window.location.pathname.startsWith('/admin')
    ? (persistedAdminUser ? 'admin' : 'admin-login')
    : null;
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [selectedCampaignSource, setSelectedCampaignSource] = useState<'id' | 'snapshot'>('id');
  const selectedCampaignSnapshotRef = useRef<CampaignRecord | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');
  const [sortBy, setSortBy] = useState('Terbaru');
  const [currentPage, setCurrentPage] = useState(1);
  const [campaignListFadeOut, setCampaignListFadeOut] = useState(false);
  const PAGE_SIZE = 6;
  const [page, setPage] = useState<Page>(initialPage);
  const [user, setUser] = useState<AppUser | null>(persistedUser);
  const [adminUser, setAdminUser] = useState<AppUser | null>(persistedAdminUser);
  const campaignStorageKey = 'bantusesama-campaigns';
  const campaignStorageBackupKey = 'bantusesama-campaigns-backup';
  const campaignUpdatedEventKey = 'bantusesama-campaigns-updated';
  const hiddenRejectedCampaignIdsKey = 'bantusesama-hidden-rejected-campaign-ids';
  const deletedUserEmailsKey = 'bantusesama-deleted-user-emails';
  const initialDeletedUserEmails = loadDeletedUserEmailsFromStorage().map(normalizeEmail);
  const [deletedUserEmails, setDeletedUserEmails] = useState<string[]>(initialDeletedUserEmails);
  const [registeredUsers, setRegisteredUsers] = useState<StoredUser[]>(() => loadRegisteredUsersFromStorage().filter((account) => !initialDeletedUserEmails.includes(normalizeEmail(account.email))));
  const [serverUsers, setServerUsers] = useState<ServerUserRow[]>([]);
  const [hiddenDemoCampaignIds, setHiddenDemoCampaignIds] = useState<number[]>(() => loadHiddenDemoCampaignIdsFromStorage());
  const [hiddenRejectedCampaignIds, setHiddenRejectedCampaignIds] = useState<number[]>(() => loadHiddenRejectedCampaignIdsFromStorage());
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>(() => loadWithdrawalRequestsFromStorage());
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentRecord[]>(() => loadPendingPaymentsFromStorage());
  const [rejectUndoState, setRejectUndoState] = useState<{ campaignId: number; previousCampaign?: CampaignRecord; expiresAt: number } | null>(null);
  const [deletedUserUndoState, setDeletedUserUndoState] = useState<{ email: string; userData: StoredUser | null; removedCampaigns: CampaignRecord[]; expiresAt: number } | null>(null);
  const [undoNow, setUndoNow] = useState(Date.now());
  const [recurringToggle, setRecurringToggle] = useState(0);
  const [campaignsHydrated, setCampaignsHydrated] = useState(false);
  const [profileEditName, setProfileEditName] = useState('');
  const [profileEditMessage, setProfileEditMessage] = useState('');
  const rejectUndoTimeoutRef = useRef<number | null>(null);
  const deletedUserUndoTimeoutRef = useRef<number | null>(null);
  const campaignPageTransitionTimerRef = useRef<number | null>(null);
  const campaignListTopRef = useRef<HTMLDivElement | null>(null);
  const syncCampaignsInFlightRef = useRef(false);
  const isUpdatingCampaignsLocallRef = useRef(false);
  const lastCampaignSyncAtRef = useRef(0);


  function loadDeletedUserEmailsFromStorage() {
    if (typeof window === 'undefined') {
      return [] as string[];
    }

    try {
      const raw = window.localStorage.getItem(deletedUserEmailsKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      const result = Array.isArray(parsed)
        ? parsed.map(normalizeEmail).filter((email) => email.length > 0)
        : [];
      console.log('[DEBUG] loadDeletedUserEmailsFromStorage:', { raw, parsed, result });
      return result;
    } catch (error) {
      console.error('[DEBUG] loadDeletedUserEmailsFromStorage error:', error);
      return [] as string[];
    }
  }

  function saveDeletedUserEmailsToStorage(emails: string[]) {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const normalized = emails.map(normalizeEmail).filter((email) => email.length > 0);
      const jsonString = JSON.stringify(normalized);
      window.localStorage.setItem(deletedUserEmailsKey, jsonString);
      console.log('[DEBUG] saveDeletedUserEmailsToStorage:', { emails, normalized, jsonString, stored: window.localStorage.getItem(deletedUserEmailsKey) });
    } catch (error) {
      console.error('[DEBUG] saveDeletedUserEmailsToStorage error:', error);
    }
  }

  const loadCampaignsFromStorage = () => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(campaignStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as CampaignRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return null;
      }

      return parsed.map(normalizeCampaignRecord);
    } catch {
      return null;
    }
  };

  const loadCampaignsBackupFromStorage = () => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(campaignStorageBackupKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as CampaignRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return null;
      }

      return parsed.map(normalizeCampaignRecord);
    } catch {
      return null;
    }
  };

  const saveCampaignsToStorage = (nextCampaigns: CampaignRecord[], preserveBackup = true) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (preserveBackup) {
        const currentRaw = window.localStorage.getItem(campaignStorageKey);
        if (currentRaw) {
          window.localStorage.setItem(campaignStorageBackupKey, currentRaw);
        }
      }
      window.localStorage.setItem(campaignStorageKey, JSON.stringify(nextCampaigns));
      window.localStorage.setItem(campaignUpdatedEventKey, String(Date.now()));
    } catch {
      // ignore write failures in environments where localStorage is unavailable
    }
  };

  const restoreCampaignsCheckpoint = () => {
    const backup = loadCampaignsBackupFromStorage();
    if (!backup || backup.length === 0) {
      return false;
    }

    const restored = normalizeCampaignsForDisplay(backup, getApiBaseUrl());
    setCampaigns(restored);
    saveCampaignsToStorage(restored, false);
    return true;
  };

  (window as any).restoreCampaignsCheckpoint = restoreCampaignsCheckpoint;

  const mergeLocalSeededCampaignUpdates = (remoteCampaigns: CampaignRecord[], localCampaigns: CampaignRecord[]) => {
    // Map local campaigns by id for quick lookup
    const localById = new Map(localCampaigns
      .filter((campaign) => Number.isFinite(campaign.id) && campaign.id > 0)
      .map((campaign) => [campaign.id, campaign] as const)
    );

    const now = Date.now();
    const recentWindowMs = 2 * 60 * 1000;
    const currentUserEmail = normalizeEmail(user?.email ?? '');

    return remoteCampaigns.map((remote) => {
      const local = localById.get(remote.id);
      if (!local) {
        return remote;
      }

      const isSeedDemoCampaign = Number.isFinite(remote.id) && remote.id > 0 && remote.id <= 6;

      // For seeded campaigns: prefer local state when it contains newer or authoritative donations.
      // Seeded campaigns are local-first; avoid downgrading local donations with stale backend data.
      if (isSeedDemoCampaign) {
        const localCollected = toSafeNumber(local.collected, 0);
        const remoteCollected = toSafeNumber(remote.collected, 0);

        const localDonations = Array.isArray(local.donations) ? local.donations : [];
        const remoteDonations = Array.isArray(remote.donations) ? remote.donations : [];

        const localMaxTs = localDonations.reduce((m, d) => Math.max(m, Number(d?.timestamp || 0)), 0);
        const remoteMaxTs = remoteDonations.reduce((m, d) => Math.max(m, Number(d?.timestamp || 0)), 0);

        const localHasCurrentUserDonation = localDonations.some((d) => {
          try {
            const donorEmail = normalizeEmail((d as any).email || (d as any).ownerEmail || '');
            return donorEmail && currentUserEmail && donorEmail === currentUserEmail;
          } catch {
            return false;
          }
        });

        // Preserve local state only when it contains a real user donation not yet reflected by the server.
        // Default seeded demo donations should not override authoritative remote campaign totals.
        const preferLocal = localHasCurrentUserDonation;

        if (preferLocal) {
          const combined = [...localDonations, ...remoteDonations];
          const seen = new Set<string>();
          const mergedDonations = combined.filter((donation) => {
            const key = `${String(donation.name || '').trim().toLowerCase()}|${donation.amount}|${String(donation.message || '').trim().toLowerCase()}|${Math.floor((donation.timestamp || 0) / 1000)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

          return {
            ...local,
            donations: mergedDonations
          };
        }
      }

      // For non-seeded or remote-higher seeded campaigns, do standard merge
      const remoteDonations = Array.isArray(remote.donations) ? remote.donations : [];
      const localDonations = Array.isArray(local.donations) ? local.donations : [];

      const preservedLocal = localDonations.filter((d) => {
        if (isSeedDemoCampaign) {
          return true;
        }

        try {
          const donorEmail = normalizeEmail((d as any).email || (d as any).ownerEmail || '');
          if (donorEmail && currentUserEmail && donorEmail === currentUserEmail) return true;
          if (!donorEmail && (d.timestamp || 0) >= (now - recentWindowMs)) return true;
        } catch (err) {
          // ignore malformed donation object
        }
        return false;
      });

      const combined = [...remoteDonations, ...preservedLocal];
      const seen = new Set<string>();
      const mergedDonations = combined.filter((donation) => {
        const key = `${String(donation.name || '').trim().toLowerCase()}|${donation.amount}|${String(donation.message || '').trim().toLowerCase()}|${Math.floor((donation.timestamp || 0) / 1000)}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return {
        ...remote,
        collected: Math.max(remote.collected, local.collected),
        donors: Math.max(remote.donors, local.donors, mergedDonations.length),
        donations: mergedDonations
      };
    });
  };

  function loadHiddenRejectedCampaignIdsFromStorage() {
    if (typeof window === 'undefined') {
      return [] as number[];
    }

    try {
      const raw = window.localStorage.getItem(hiddenRejectedCampaignIdsKey);
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(id) && id > 0) : [];
    } catch {
      return [] as number[];
    }
  }

  const saveHiddenRejectedCampaignIdsToStorage = (ids: number[]) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(hiddenRejectedCampaignIdsKey, JSON.stringify(ids));
    } catch {
      // ignore write failures
    }
  };

  const syncCampaignsFromServer = async (
    cancelledRef?: { current: boolean },
    extraHiddenDemoCampaignIds: number[] = [],
    localCampaignsOverride?: CampaignRecord[]
  ): Promise<boolean> => {
    const now = Date.now();
    if (syncCampaignsInFlightRef.current || (now - lastCampaignSyncAtRef.current) < 5000) {
      return false;
    }

    syncCampaignsInFlightRef.current = true;
    try {
      lastCampaignSyncAtRef.current = now;
      const response = await fetch(apiUrl(`/api/campaigns?_=${now}`), { cache: 'no-store' });
      if ((cancelledRef?.current ?? false) || !response.ok) {
        return false;
      }

      const list = await response.json();
      if (!Array.isArray(list)) {
        return false;
      }

      const hiddenDemoIds = new Set([...hiddenDemoCampaignIds, ...extraHiddenDemoCampaignIds]);

      let remoteCampaigns = normalizeCampaignsForDisplay(list.map(normalizeCampaignRecord), getApiBaseUrl());
      remoteCampaigns = remoteCampaigns.filter((campaign) => (
        !hiddenDemoIds.has(campaign.id)
        && campaign.status !== 'rejected'
      ));

      const localCampaignsToMerge = localCampaignsOverride ?? campaigns;
      remoteCampaigns = mergeLocalSeededCampaignUpdates(remoteCampaigns, localCampaignsToMerge);

      // Preserve seeded demo campaigns from local state whenever possible.
      // This prevents a successful server sync from temporarily removing local-only seeded campaigns.
      const localSeededCampaigns = (localCampaignsOverride ?? campaigns)
        .filter((campaign) => Number.isFinite(campaign.id) && campaign.id >= 1 && campaign.id <= 6)
        .filter((campaign) => !hiddenDemoIds.has(campaign.id));
      if (localSeededCampaigns.length > 0) {
        remoteCampaigns = dedupeCampaigns([...remoteCampaigns, ...localSeededCampaigns]);
      }

      // Always restore seeded campaigns (1..6) - they are core to the platform and should never disappear
      // even if backend sync returns no campaigns or incomplete data
      const remoteSeededIds = new Set(remoteCampaigns
        .filter((c) => c.id >= 1 && c.id <= 6)
        .map((c) => c.id)
      );
      
      // Collect seeded campaigns from multiple sources: local override, current state, and current campaigns
      // This ensures we can find and restore seeded campaigns even if intermediate states are incomplete
      const allLocalSources = [
        ...(localCampaignsOverride || []),
        ...campaigns
      ];
      const uniqueLocalSources = new Map(allLocalSources.map((c) => [c.id, c] as const));
      
      const missingSeededCampaigns = Array.from({ length: 6 }, (_, i) => i + 1)
        .filter((id) => !remoteSeededIds.has(id) && !hiddenDemoIds.has(id))
        .map((id) => uniqueLocalSources.get(id))
        .filter((c): c is CampaignRecord => c !== undefined && c.status !== 'rejected');
      
      if (missingSeededCampaigns.length > 0) {
        remoteCampaigns = dedupeCampaigns([...remoteCampaigns, ...missingSeededCampaigns]);
      }

      if (cancelledRef?.current) {
        return false;
      }

      if (remoteCampaigns.length === 0) {
        // Keep existing campaigns when server temporarily returns an empty list
        // to avoid UI flicker (appears then disappears) during intermittent sync.
        console.warn('[CampaignSync] Ignoring empty campaign sync result to preserve current list');
        return false;
      }

      const hasPublicCampaign = remoteCampaigns.some((campaign) => (
        campaign.status !== 'pending' && campaign.status !== 'rejected'
      ));

      if (page !== 'admin' && !hasPublicCampaign) {
        // Public page hides pending/rejected campaigns. If server only returns those,
        // keep current visible list instead of replacing it with an apparently empty UI.
        console.warn('[CampaignSync] Ignoring non-public-only sync result on public page');
        return false;
      }

      // Server-side campaign list should be authoritative for public listings.
      setCampaigns(remoteCampaigns);
      try {
        isUpdatingCampaignsLocallRef.current = true;
        saveCampaignsToStorage(remoteCampaigns);
      } catch {
        // ignore write failures
      } finally {
        isUpdatingCampaignsLocallRef.current = false;
      }
      return true;
    } catch (err) {
      return false;
    } finally {
      syncCampaignsInFlightRef.current = false;
    }
  };

  const normalizeCampaignsForDisplay = (items: CampaignRecord[], apiBase: string) => {
    const originalImagesFor1to6: Record<number, string> = {
      1: 'https://images.unsplash.com/photo-1767678384957-7ba885ab06d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      2: 'https://images.unsplash.com/photo-1774370793502-85098cd3fd00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      3: 'https://images.unsplash.com/photo-1762592957827-99db60cfd0c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMG1hcmtldCUyMGZvb2QlMjB2ZW5kb3J8ZW58MXx8fHwxNzc3NTMyOTM3fDA&ixlib=rb-4.1.0&q=80&w=1080',
      4: 'https://images.unsplash.com/photo-1768637758036-9a690925ae72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      5: 'https://images.unsplash.com/photo-1757763006278-d0fa5d582d0d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      6: 'https://images.unsplash.com/photo-1767678233351-9308d8220fa5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw1fHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'
    };

    const normalizedItems = items.map(normalizeCampaignRecord);

    return dedupeCampaigns(normalizedItems)
      .filter((campaign) => campaign.status !== 'rejected')
      .map((campaign) => {
      if (campaign && typeof campaign.id === 'number' && originalImagesFor1to6[campaign.id]) {
        return { ...campaign, image: originalImagesFor1to6[campaign.id] };
      }

      try {
        if (typeof campaign.image === 'string') {
          // Preserve absolute external URLs as-is (do not rewrite to image-proxy).
          // If image path is root-relative, prefix with apiBase so it resolves correctly.
          if (campaign.image.startsWith('/')) {
            if (apiBase) {
              return { ...campaign, image: `${apiBase}${campaign.image}` };
            }
          }

          // If it's already an absolute http(s) URL, keep it unchanged so the
          // frontend can load the original image directly. This restores the
          // previous behaviour where external images were used instead of
          // forcing the backend image-proxy.
          if (campaign.image.startsWith('http')) {
            return campaign;
          }
        }
      } catch (err) {
        // ignore malformed urls
      }

        return campaign;
      })
      .filter(isRenderableCampaign);
  };

  const getCampaignIdFromUrl = () => {
    const campaignParam = new URLSearchParams(window.location.search).get('campaign');
    if (!campaignParam) {
      return null;
    }

    const parsedCampaignId = Number(campaignParam);
    return Number.isFinite(parsedCampaignId) ? parsedCampaignId : null;
  };

  const getPaymentContinueFromUrl = () => {
    const paymentParam = new URLSearchParams(window.location.search).get('payment');
    return paymentParam === 'continue';
  };

  const updateCurrentUserName = (nextName: string) => {
    const trimmedName = nextName.trim();
    if (!user?.email || !trimmedName) {
      return false;
    }

    const nextRegisteredUsers = loadRegisteredUsersFromStorage().map((account) => (
      account.email === user.email ? { ...account, name: trimmedName } : account
    ));

    setRegisteredUsers(nextRegisteredUsers);
    window.localStorage.setItem(registeredUsersKey, JSON.stringify(nextRegisteredUsers));
    setUser((currentUser) => (currentUser ? { ...currentUser, name: trimmedName } : currentUser));
    setProfileEditName(trimmedName);
    setProfileEditMessage('Nama akun berhasil diperbarui.');
    return true;
  };

  const openPendingPayment = (payment: Partial<PendingPaymentRecord> & { donationId: number; orderId: string; campaignTitle: string; amount: number; method: 'virtual_account' | 'ewallet'; createdAt?: number; redirectUrl?: string }) => {
    const params = new URLSearchParams({
      payment: 'continue',
      donationId: String(payment.donationId || ''),
      orderId: String(payment.orderId || ''),
      method: payment.method || 'ewallet',
      campaignTitle: payment.campaignTitle || '',
      amount: String(payment.amount || '')
    });

    if (payment.redirectUrl) {
      params.set('redirectUrl', payment.redirectUrl);
    }

    setSelectedCampaign(null);
    setSelectedCampaignSource('id');
    // Push history first, then change page to ensure URL is available when component mounts
    window.history.pushState({ view: 'payment-continue' }, '', `/?${params.toString()}`);
    setPage('lanjut-pembayaran');
  };

  useEffect(() => {
    const syncFromHistory = () => {
      const state = window.history.state as { view?: string; campaignId?: number } | null;
      const campaignIdFromUrl = getCampaignIdFromUrl();
      const paymentContinueFromUrl = getPaymentContinueFromUrl();

      if (state?.view === 'campaign' && typeof state.campaignId === 'number') {
        setSelectedCampaign(state.campaignId);
        setSelectedCampaignSource('id');
        setPage(null);
        return;
      }

      if (campaignIdFromUrl) {
        setSelectedCampaign(campaignIdFromUrl);
        setSelectedCampaignSource('id');
        setPage(null);
        window.history.replaceState({ view: 'campaign', campaignId: campaignIdFromUrl }, '', `/?campaign=${campaignIdFromUrl}`);
        return;
      }

      if (paymentContinueFromUrl) {
        setSelectedCampaign(null);
        setSelectedCampaignSource('id');
        setPage('lanjut-pembayaran');
        window.history.replaceState({ view: 'lanjut-pembayaran' }, '', `/?${window.location.search.replace(/^\?/, '')}`);
        return;
      }

      setSelectedCampaign(null);
      setSelectedCampaignSource('id');
      setPage((state?.view as Page) ?? null);
    };

    const campaignIdFromUrl = getCampaignIdFromUrl();
    const paymentContinueFromUrl = getPaymentContinueFromUrl();
    const initialView = window.location.pathname.startsWith('/admin')
      ? 'admin-login'
      : paymentContinueFromUrl
        ? 'lanjut-pembayaran'
        : 'home';
    const initialPath = window.location.pathname.startsWith('/admin') ? '/admin' : '/';

    if (campaignIdFromUrl) {
      setSelectedCampaign(campaignIdFromUrl);
      setSelectedCampaignSource('id');
      window.history.replaceState({ view: 'campaign', campaignId: campaignIdFromUrl }, '', `/?campaign=${campaignIdFromUrl}`);
    } else if (paymentContinueFromUrl) {
      window.history.replaceState({ view: 'lanjut-pembayaran' }, '', `/?${window.location.search.replace(/^\?/, '')}`);
    } else {
      window.history.replaceState({ view: initialView }, '', initialPath + window.location.search);
    }
    window.addEventListener('popstate', syncFromHistory);

    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);

  const openCampaign = (campaignId: number) => {
    setSelectedCampaign(campaignId);
    setSelectedCampaignSource('id');
    setPage(null);
    window.history.pushState(
      { view: 'campaign', campaignId },
      '',
      `/?campaign=${campaignId}`
    );
  };

  const closeCampaign = () => {
    if (window.history.state?.view === 'campaign') {
      window.history.back();
      return;
    }

    setSelectedCampaign(null);
    setSelectedCampaignSource('id');
  };

  const goHome = () => {
    setSelectedCampaign(null);
    setSelectedCampaignSource('id');
    setPage(null);
    window.history.pushState(
      { view: 'home' },
      '',
      '/'
    );
  };


  const navigatePage = (nextPage: string) => {
    const resolvedPage = nextPage as Page;

    setSelectedCampaign(null);
    setSelectedCampaignSource('id');

    setPage(resolvedPage);
    const nextPath = resolvedPage === 'admin' || resolvedPage === 'admin-login' ? '/admin' : '/';
    window.history.pushState(
      { view: resolvedPage ?? 'home' },
      '',
      nextPath
    );
  };

  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(() => {
    try {
      const stored = loadCampaignsFromStorage();
      if (stored && Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
    } catch {
      // fall back to seeded defaults below
    }

    return [
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
      donations: seededDemoDonationsByCampaignId[1],
      story: `Bu Siti (52 tahun) adalah pemilik warung makan sederhana di Kampung Melayu, Jakarta Timur yang sudah berdiri sejak 15 tahun lalu. Warung ini menjadi satu-satunya sumber penghasilan untuk menghidupi keluarganya, termasuk dua anaknya yang masih bersekolah.

Pada tanggal 15 Maret 2026, banjir besar melanda kawasan tersebut dengan ketinggian air mencapai 1,5 meter. Warung Bu Siti terendam selama 3 hari, mengakibatkan:
- Semua peralatan dapur (kompor gas, panci, wajan) rusak total
- Kulkas dan freezer tidak bisa digunakan lagi
- Meja dan kursi kayu rusak dan berjamur
- Bahan makanan dan bumbu habis terendam
- Keramik lantai dan cat dinding rusak

Total kerugian diperkirakan mencapai Rp 15.000.000. Bu Siti sudah berusaha membuka kembali warungnya dengan peralatan seadanya, namun sangat kesulitan karena tidak memiliki modal untuk membeli peralatan baru.

Dana yang terkumpul akan digunakan untuk:
1. Renovasi warung (cat ulang, perbaikan lantai) - Rp 4.000.000
2. Peralatan dapur lengkap - Rp 5.000.000
3. Kulkas dan freezer - Rp 4.000.000
4. Modal awal bahan makanan - Rp 2.000.000

Mari kita bantu Bu Siti untuk bangkit kembali dan melanjutkan usahanya! 🙏`,
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
      donations: seededDemoDonationsByCampaignId[2],
      story: `Pada dini hari tanggal 5 April 2026, kebakaran hebat melanda Pasar Minggu, Jakarta Selatan. Api yang berasal dari korsleting listrik dengan cepat melalap 45 kios pedagang yang mayoritas berjualan bahan makanan, pakaian, dan kebutuhan sehari-hari.

Kerugian yang dialami:
- 45 kios pedagang hangus terbakar
- Ribuan barang dagangan musnah
- Tidak ada asuransi yang dapat menanggung kerugian
- Pedagang kehilangan sumber mata pencaharian

Para pedagang ini adalah kepala keluarga yang menggantungkan hidup dari berjualan di pasar. Mereka sudah berdagang puluhan tahun dan memiliki pelanggan setia. Namun, kebakaran ini membuat mereka kehilangan segalanya.

Target dana Rp 50.000.000 akan dibagikan kepada 45 pedagang (sekitar Rp 1.111.000 per pedagang) sebagai modal awal untuk:
- Membeli barang dagangan
- Menyewa kios sementara
- Peralatan berjualan

Dengan bantuan Anda, para pedagang dapat bangkit dan melanjutkan usaha mereka. Setiap rupiah sangat berarti! 🙏`,
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
      donations: seededDemoDonationsByCampaignId[3],
      story: `Pak Joko (45 tahun) adalah pedagang sate keliling yang sudah berjualan selama 20 tahun di kawasan Dago, Bandung. Sate Pak Joko terkenal enak dan selalu ramai pembeli setiap malam.

Pada tanggal 20 Maret 2026, ketika Pak Joko sedang istirahat sebentar untuk sholat, gerobak satenya dicuri orang yang tidak bertanggung jawab. Gerobak tersebut berisi:
- Kompor gas dan tabung gas
- Alat panggang sate (3 buah)
- Panci dan peralatan masak
- Meja dan kursi lipat
- Lemari es kecil
- Persediaan bumbu dan bahan

Total kerugian mencapai Rp 8.000.000. Pak Joko sudah melapor ke polisi namun gerobak belum ditemukan. Sejak kejadian itu, Pak Joko tidak bisa berjualan dan kehilangan penghasilan untuk menghidupi istri dan 3 anaknya.

Dana yang terkumpul akan digunakan untuk:
1. Gerobak sate baru - Rp 4.000.000
2. Kompor gas dan tabung - Rp 1.500.000
3. Alat panggang dan peralatan - Rp 1.500.000
4. Modal bahan baku - Rp 1.000.000

Mari kita bantu Pak Joko untuk bisa berjualan lagi! 🍢`,
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
      donations: seededDemoDonationsByCampaignId[4],
      story: `Ibu Ani (38 tahun) adalah penjahit rumahan di Surabaya yang sudah menekuni profesi ini selama 12 tahun. Dari hasil jahit-menjahit, Ibu Ani bisa menghidupi kedua anaknya yang masih sekolah.

Orderan jahitan Ibu Ani selalu ramai, mulai dari jahit baju, pembuatan seragam, hingga reparasi pakaian. Rata-rata penghasilan Ibu Ani mencapai Rp 3-4 juta per bulan.

Namun pada bulan Maret 2026, mesin jahit Ibu Ani yang sudah berusia 15 tahun mengalami kerusakan parah:
- Dinamo mesin mati total
- Gear penggerak patah
- Body mesin berkarat
- Tidak ekonomis untuk diperbaiki

Karena tidak memiliki mesin jahit, Ibu Ani terpaksa menolak semua orderan. Penghasilannya hilang dan keluarga kesulitan untuk memenuhi kebutuhan sehari-hari.

Dana yang dibutuhkan:
1. Mesin jahit portable baru - Rp 4.000.000
2. Mesin obras - Rp 1.500.000
3. Peralatan jahit (gunting, meteran, dll) - Rp 500.000

Dengan bantuan Anda, Ibu Ani bisa kembali produktif dan menghidupi keluarganya! 🧵`,
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
      donations: seededDemoDonationsByCampaignId[5],
      story: `Warung Kopi "Ngopi Gunung" milik Mas Budi (42 tahun) berlokasi di kawasan wisata Puncak, Bogor. Warung ini sudah berdiri 8 tahun dan menjadi tempat favorit wisatawan untuk menikmati kopi sambil melihat pemandangan gunung.

Pada tanggal 10 April 2026, hujan deras yang terjadi selama 3 hari menyebabkan tanah longsor di sekitar warung. Akibatnya:
- Bagian belakang warung roboh
- Mesin kopi espresso rusak terkena tanah
- Meja dan kursi hancur
- Kaca jendela pecah
- Instalasi listrik rusak total

Kerugian material mencapai Rp 20.000.000. Mas Budi yang juga harus menghidupi 4 orang karyawan sangat membutuhkan bantuan untuk membangun kembali warungnya.

Rencana penggunaan dana:
1. Perbaikan struktur bangunan - Rp 10.000.000
2. Mesin kopi espresso baru - Rp 6.000.000
3. Furniture (meja, kursi) - Rp 2.500.000
4. Instalasi listrik & renovasi - Rp 1.500.000

Bantu Mas Budi untuk membuka kembali warung kopinya! ☕`,
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
      donations: seededDemoDonationsByCampaignId[6],
      story: `Bu Wati (48 tahun) adalah pedagang sayur keliling di Yogyakarta. Setiap pagi jam 4, Bu Wati berangkat ke pasar induk untuk membeli sayuran segar, kemudian menjualnya keliling kampung menggunakan motor bebek yang sudah dimodifikasi dengan bak besar.

Pada tanggal 2 April 2026, motor Bu Wati hilang dicuri saat diparkir di pasar. Motor tersebut sudah dilengkapi dengan:
- Bak besar untuk sayuran
- Timbangan digital
- Kanopi pelindung
- Keranjang plastik (20 buah)

Total nilai motor dan perlengkapan mencapai Rp 12.000.000. Sejak motor hilang, Bu Wati tidak bisa berjualan karena tidak ada kendaraan untuk mengangkut sayuran. Padahal dari jualan sayur inilah Bu Wati menghidupi dirinya dan ibu yang sudah sepuh.

Dana yang dibutuhkan:
1. Motor bebek bekas (2015-2017) - Rp 8.000.000
2. Modifikasi bak sayuran - Rp 2.500.000
3. Perlengkapan berjualan - Rp 1.000.000
4. Modal sayuran - Rp 500.000

Mari kita bantu Bu Wati untuk bisa berjualan lagi! 🥬`,
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
  });
  const defaultSeededCampaignsRef = useRef<CampaignRecord[]>(campaigns.filter((campaign) => campaign.id >= 1 && campaign.id <= 6));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Disable automatic dev-side user registration sync on startup.
      // This was causing repeated 400 responses when demo/local users already existed server-side.
      // If future behavior is needed, add explicit user migration logic with proper status handling.

      const storedCampaigns = loadCampaignsFromStorage();
      const localCampaigns = storedCampaigns !== null
        ? normalizeCampaignsForDisplay(storedCampaigns, getApiBaseUrl())
          .filter((campaign) => (
            campaign.status !== 'rejected'
            && !hiddenDemoCampaignIds.includes(campaign.id)
          ))
        : null;

      const shouldPrioritizeServerForAdmin = page === 'admin' && Boolean(adminUser);

      // Prepare hydration campaigns with seeded campaigns always included
      let hydrationCampaigns = campaigns; // Use initial seeded campaigns as base
      
      if (!cancelled && !shouldPrioritizeServerForAdmin && localCampaigns !== null && localCampaigns.length > 0) {
        // Ensure seeded campaigns (1-6) are always preserved when hydrating from storage
        const currentSeeded = campaigns.filter((c) => c.id >= 1 && c.id <= 6);
        const storedSeededIds = new Set(localCampaigns.filter((c) => c.id >= 1 && c.id <= 6).map((c) => c.id));
        const missingSeeded = currentSeeded.filter((c) => !storedSeededIds.has(c.id));
        
        hydrationCampaigns = dedupeCampaigns([...localCampaigns, ...missingSeeded]);
        setCampaigns(hydrationCampaigns);
      }

      if (!cancelled) {
        setCampaignsHydrated(true);
      }

      // Pass hydrationCampaigns (which includes seeded) to syncCampaignsFromServer as override source
      // This ensures seeded campaigns are available for restoration even if campaigns state hasn't updated
      const synced = await syncCampaignsFromServer({ current: cancelled }, [], hydrationCampaigns);
      if (!cancelled && !synced && localCampaigns !== null && localCampaigns.length > 0) {
        // Ensure seeded campaigns are preserved even if sync fails
        const currentSeeded = campaigns.filter((c) => c.id >= 1 && c.id <= 6);
        const localSeededIds = new Set(localCampaigns.filter((c) => c.id >= 1 && c.id <= 6).map((c) => c.id));
        const missingSeeded = currentSeeded.filter((c) => !localSeededIds.has(c.id));
        
        const fallbackCampaigns = dedupeCampaigns([...localCampaigns, ...missingSeeded]);
        setCampaigns(fallbackCampaigns);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const shouldSync = () => {
      const now = Date.now();
      return !syncCampaignsInFlightRef.current && (now - lastCampaignSyncAtRef.current) >= 5000;
    };

    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible' && shouldSync()) {
        void syncCampaignsFromServer();
      }
    };

    const handleFocusSync = () => {
      if (shouldSync()) {
        void syncCampaignsFromServer();
      }
    };

    // Only poll in admin page; public pages sync on visibility change/focus only
    const pollInterval = page === 'admin' ? 60000 : null; // 60 seconds for admin, disabled for public
    const intervalId = pollInterval ? window.setInterval(() => {
      if (document.visibilityState === 'visible' && shouldSync()) {
        void syncCampaignsFromServer();
      }
    }, pollInterval) : null;

    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [page]);

  // Sync campaigns from server when entering admin page
  useEffect(() => {
    if (page === 'admin' && adminUser) {
      void syncCampaignsFromServer();
    }
  }, [page, adminUser]);

  useEffect(() => {
    setCampaigns((prev) => {
      const needsNormalization = prev.some((campaign) => (
        !campaign.story
        || !campaign.fullDescription
        || !Array.isArray(campaign.fundAllocation)
        || !Array.isArray(campaign.disbursementHistory)
      ));

      if (!needsNormalization) {
        return prev;
      }

      return prev.map(normalizeCampaignRecord);
    });
  }, []);

  useEffect(() => {
    if (!campaignsHydrated) {
      return;
    }

    try {
      isUpdatingCampaignsLocallRef.current = true;
      saveCampaignsToStorage(campaigns);
    } catch {
      // ignore write failures in environments where localStorage is unavailable
    } finally {
      isUpdatingCampaignsLocallRef.current = false;
    }
  }, [campaigns, campaignsHydrated]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      // Skip sync if we just updated localStorage ourselves to prevent feedback loop
      if (isUpdatingCampaignsLocallRef.current) {
        return;
      }

      if (event.key === campaignStorageKey || event.key === campaignUpdatedEventKey) {
        const now = Date.now();
        if ((now - lastCampaignSyncAtRef.current) >= 5000 && !syncCampaignsInFlightRef.current) {
          void syncCampaignsFromServer();
        }
      }

      if (event.key === adminSessionKey) {
        setAdminUser(loadAdminSessionFromStorage());
      }

      if (event.key === userSessionKey) {
        const storedUser = loadUserSessionFromStorage();
        setUser(storedUser);
      }

      if (event.key === registeredUsersKey) {
        const loaded = loadRegisteredUsersFromStorage();
        console.log('[DEBUG] storage event registeredUsersKey:', { loaded, currentDeletedUserEmails: deletedUserEmails });
        setRegisteredUsers(loaded);
      }

      if (event.key === withdrawalRequestsKey) {
        setWithdrawalRequests(loadWithdrawalRequestsFromStorage());
      }

      if (event.key === pendingPaymentsKey) {
        setPendingPayments(loadPendingPaymentsFromStorage());
      }

      if (event.key === hiddenDemoCampaignIdsKey) {
        const nextHiddenIds = loadHiddenDemoCampaignIdsFromStorage();
        setHiddenDemoCampaignIds(nextHiddenIds);
        setCampaigns((prev) => prev.filter((campaign) => !nextHiddenIds.includes(campaign.id)));
      }

      if (event.key === hiddenRejectedCampaignIdsKey) {
        const nextHiddenIds = loadHiddenRejectedCampaignIdsFromStorage();
        setHiddenRejectedCampaignIds(nextHiddenIds);
        setCampaigns((prev) => prev.filter((campaign) => (
          campaign.status !== 'rejected'
          || !nextHiddenIds.includes(campaign.id)
        )));
      }

      if (event.key === deletedUserEmailsKey) {
        const nextDeletedEmails = loadDeletedUserEmailsFromStorage().map(normalizeEmail);
        setDeletedUserEmails(nextDeletedEmails);
        setServerUsers((prev) => prev.filter((account) => !nextDeletedEmails.includes(normalizeEmail(account.email))));
        setRegisteredUsers((prev) => prev.filter((account) => !nextDeletedEmails.includes(normalizeEmail(account.email))));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (hiddenRejectedCampaignIds.length === 0) {
      return;
    }

    setCampaigns((prev) => prev.filter((campaign) => (
      campaign.status !== 'rejected'
      || !hiddenRejectedCampaignIds.includes(campaign.id)
    )));
  }, [hiddenRejectedCampaignIds]);

  useEffect(() => {
    console.log('[DEBUG] deletedUserEmails changed:', deletedUserEmails);
  }, [deletedUserEmails]);

  useEffect(() => {
    if (!campaignsHydrated) {
      return;
    }

    setCampaigns((prev) => {
      const filtered = prev.filter((campaign) => !legacyPaginationMockTitles.has(toSafeText(campaign.title)));
      if (filtered.length === prev.length) {
        return prev;
      }
      return filtered;
    });
  }, [campaignsHydrated]);

  useEffect(() => {
    if (!rejectUndoState && !deletedUserUndoState) {
      return;
    }

    const tickInterval = window.setInterval(() => {
      setUndoNow(Date.now());
    }, 250);

    return () => window.clearInterval(tickInterval);
  }, [rejectUndoState, deletedUserUndoState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!campaignsHydrated) {
      return;
    }

    if (window.localStorage.getItem(campaignCleanupVersionKey) !== campaignCleanupVersion) {
      window.localStorage.removeItem(campaignStorageKey);
      window.localStorage.setItem(campaignCleanupVersionKey, campaignCleanupVersion);
      return;
    }

    const cleanedCampaigns = dedupeCampaigns(campaigns);
    if (cleanedCampaigns.length !== campaigns.length) {
      setCampaigns(cleanedCampaigns);
      return;
    }

    window.localStorage.setItem(campaignStorageKey, JSON.stringify(cleanedCampaigns));
  }, [campaigns, campaignsHydrated]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/users'));
        if (!response.ok) {
          return;
        }

        const list = await response.json();
        if (cancelled || !Array.isArray(list)) {
          return;
        }

        const mapped = list
          .map((item: any) => ({
            id: Number(item.id),
            name: toSafeText(item.name),
            email: toSafeText(item.email)
          }))
          .filter((item: ServerUserRow) => Number.isFinite(item.id) && item.email.length > 0);

        const currentDeletedEmails = loadDeletedUserEmailsFromStorage().map(normalizeEmail);
        const filtered = mapped.filter((account) => !currentDeletedEmails.includes(normalizeEmail(account.email)));
        console.log('[DEBUG] fetch /api/auth/users:', { mapped, currentDeletedEmails, filtered });
        setServerUsers(filtered);
      } catch {
        // keep local fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(withdrawalRequestsKey, JSON.stringify(withdrawalRequests));
  }, [withdrawalRequests]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(pendingPaymentsKey, JSON.stringify(pendingPayments));
  }, [pendingPayments]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const deletedEmails = loadDeletedUserEmailsFromStorage().map(normalizeEmail);
    if (deletedEmails.length === 0) {
      return;
    }

    setRegisteredUsers((prev) => {
      const next = prev.filter((user) => !deletedEmails.includes(normalizeEmail(user.email)));
      if (next.length !== prev.length) {
        try {
          window.localStorage.setItem(registeredUsersKey, JSON.stringify(next));
        } catch {
          // ignore write failures
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    saveDeletedUserEmailsToStorage(deletedUserEmails);
  }, [deletedUserEmails]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    saveUserSessionToStorage(user);
  }, [user]);

  const _userEmail = (user?.email || null);
  const visiblePendingPayments = _userEmail
    ? pendingPayments.filter((payment) => {
        if (!payment.ownerEmail) return true;
        try {
          return String(payment.ownerEmail).toLowerCase() === String(_userEmail).toLowerCase();
        } catch {
          return false;
        }
      })
    : [];

  const recurringDonationStatus = getRecurringDonationForEmail(user?.email);

  const doesDonationBelongToUser = (donation: any, email?: string | null) => {
    if (!email) {
      return false;
    }

    const ownerEmail = donation?.ownerEmail || donation?.email;
    return typeof ownerEmail === 'string' && normalizeEmail(ownerEmail) === normalizeEmail(email);
  };

  const campaignsSortedByTime = [...campaigns].sort((a, b) => (b.createdAt ?? b.id) - (a.createdAt ?? a.id));
  const mockCampaigns = campaignsSortedByTime.filter((campaign) => campaign.id >= 1000);
  const realCampaigns = campaignsSortedByTime.filter((campaign) => campaign.id < 1000);
  const campaignsForDisplay = normalizeCampaignsForDisplay([...mockCampaigns, ...realCampaigns], getApiBaseUrl())
    .filter((campaign) => (
      campaign.status !== 'rejected'
      && !hiddenDemoCampaignIds.includes(campaign.id)
      && !hiddenRejectedCampaignIds.includes(campaign.id)
      && !legacyPaginationMockTitles.has(toSafeText(campaign.title))
    ));

  const userDonationHistoryForDisplay = user
    ? campaignsForDisplay.flatMap((campaign) => {
        if (campaign.donations && campaign.donations.length > 0) {
          return [...campaign.donations]
            .reverse()
            .filter((donation) => doesDonationBelongToUser(donation, user.email))
            .map((donation, index) => ({
              id: campaign.id * 1000 + index,
              campaignTitle: campaign.title,
              amount: donation.amount,
              date: new Date(donation.timestamp).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }),
              status: 'Sukses' as const,
              campaignId: campaign.id,
              timestamp: donation.timestamp
            }));
        }

        if (campaign.donors > 0) {
          return [{
            id: campaign.id,
            campaignTitle: campaign.title,
            amount: campaign.collected,
            date: new Date(campaign.createdAt ?? Date.now()).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }),
            status: 'Sukses' as const,
            campaignId: campaign.id
          }];
        }

        return [];
      })
    : [];

  const pendingDonationsForDisplay = visiblePendingPayments.map((payment, index) => ({
    id: 1000000 + index,
    campaignTitle: payment.campaignTitle,
    amount: payment.amount,
    date: new Date(payment.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    status: 'Dalam Proses' as const,
    campaignId: 0,
    timestamp: payment.createdAt
  }));

  const donationHistoryForDisplay = [...pendingDonationsForDisplay, ...userDonationHistoryForDisplay];

  // Ensure global sort: newest donations first
  donationHistoryForDisplay.sort((a, b) => {
    const ta = Number((a as any).timestamp || 0);
    const tb = Number((b as any).timestamp || 0);
    return tb - ta;
  });

  const baseAdminUsers: AdminUserRow[] = [
    { id: 1, name: 'Admin Utama', email: 'admin@bantusesama.id', role: 'admin', status: 'active', campaignCount: campaigns.filter((campaign) => campaign.creatorEmail === 'admin@bantusesama.id').length },
    { id: 2, name: 'Dewi Prasetyo', email: 'dewi@bantusesama.id', role: 'user', status: 'active', campaignCount: campaigns.filter((campaign) => campaign.creatorEmail === 'dewi@bantusesama.id').length },
    { id: 3, name: 'Rizky Maulana', email: 'rizky@bantusesama.id', role: 'user', status: 'pending', campaignCount: campaigns.filter((campaign) => campaign.creatorEmail === 'rizky@bantusesama.id').length },
    { id: 4, name: 'Sari Wulandari', email: 'sari@bantusesama.id', role: 'user', status: 'active', campaignCount: campaigns.filter((campaign) => campaign.creatorEmail === 'sari@bantusesama.id').length },
  ];

  const normalizedDeletedEmails = deletedUserEmails.map(normalizeEmail);

  const serverRegisteredRows: AdminUserRow[] = (serverUsers.length > 0 ? serverUsers : registeredUsers)
    .filter((account) => !baseAdminUsers.some((item) => normalizeEmail(item.email) === normalizeEmail(account.email)))
    .map((account, index) => ({
      id: 1000 + index,
      name: account.name,
      email: account.email,
      role: 'user',
      status: 'active',
      campaignCount: campaigns.filter((campaign) => normalizeEmail(campaign.creatorEmail) === normalizeEmail(account.email)).length
    }));

  const localRegisteredRows: AdminUserRow[] = registeredUsers
    .filter((account) => !baseAdminUsers.some((item) => normalizeEmail(item.email) === normalizeEmail(account.email)))
    .map((account, index) => ({
      id: 2000 + index,
      name: account.name,
      email: account.email,
      role: 'user',
      status: 'active',
      campaignCount: campaigns.filter((campaign) => normalizeEmail(campaign.creatorEmail) === normalizeEmail(account.email)).length
    }));

  const adminUsers = [...baseAdminUsers, ...serverRegisteredRows, ...localRegisteredRows]
    .filter((item) => !normalizedDeletedEmails.includes(normalizeEmail(item.email)))
    .filter((item, index, arr) => arr.findIndex((other) => normalizeEmail(other.email) === normalizeEmail(item.email)) === index)
    .sort((a, b) => a.id - b.id);
  
  console.log('[DEBUG] adminUsers computed:', { normalizedDeletedEmails, adminUsersCount: adminUsers.length, adminUsers: adminUsers.map(u => u.email) });

  const clearRejectUndoTimer = () => {
    if (rejectUndoTimeoutRef.current) {
      window.clearTimeout(rejectUndoTimeoutRef.current);
      rejectUndoTimeoutRef.current = null;
    }
  };

  const clearDeletedUserUndoTimer = () => {
    if (deletedUserUndoTimeoutRef.current) {
      window.clearTimeout(deletedUserUndoTimeoutRef.current);
      deletedUserUndoTimeoutRef.current = null;
    }
  };

  const startRejectUndo = (campaignId: number, previousCampaign?: CampaignRecord) => {
    clearRejectUndoTimer();

    const expiresAt = Date.now() + 5000;
    setRejectUndoState({ campaignId, previousCampaign, expiresAt });
    rejectUndoTimeoutRef.current = window.setTimeout(() => {
      setRejectUndoState(null);
      rejectUndoTimeoutRef.current = null;
      
      // After undo time expires, permanently remove the rejected campaign
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    }, 5000);
  };

  const undoRejectCampaign = () => {
    if (!rejectUndoState) {
      return;
    }

    const { campaignId, previousCampaign } = rejectUndoState;

    setHiddenRejectedCampaignIds((prev) => {
      const next = prev.filter((id) => id !== campaignId);
      saveHiddenRejectedCampaignIdsToStorage(next);
      return next;
    });

    setCampaigns((prev) => {
      if (!previousCampaign) {
        return prev;
      }
      const filtered = prev.filter((campaign) => campaign.id !== campaignId);
      return [...filtered, previousCampaign];
    });

    clearRejectUndoTimer();
    setRejectUndoState(null);

    void (async () => {
      try {
        await updateCampaignStatusOnServer(campaignId, 'pending');
        await syncCampaignsFromServer();
      } catch (err) {
        console.error('Error undoing rejected campaign:', err);
        window.alert('Gagal membatalkan penolakan kampanye. Silakan refresh halaman untuk memastikan status terbaru.');
      }
    })();
  };

  const startDeletedUserUndo = (email: string, userData: StoredUser | null, removedCampaigns: CampaignRecord[]) => {
    clearDeletedUserUndoTimer();

    const expiresAt = Date.now() + 5000;
    setDeletedUserUndoState({ email, userData, removedCampaigns, expiresAt });
    deletedUserUndoTimeoutRef.current = window.setTimeout(() => {
      setDeletedUserUndoState(null);
      deletedUserUndoTimeoutRef.current = null;
    }, 5000);
  };

  const undoDeletedUser = () => {
    if (!deletedUserUndoState) {
      return;
    }

    if (deletedUserUndoState.userData) {
      const nextUsers = [...registeredUsers, deletedUserUndoState.userData].filter(
        (account, index, arr) => arr.findIndex((item) => item.email === account.email) === index
      );
      setRegisteredUsers(nextUsers);
      window.localStorage.setItem(registeredUsersKey, JSON.stringify(nextUsers));
    }

    const nextDeletedEmails = deletedUserEmails.filter((email) => email !== deletedUserUndoState.email);
    setDeletedUserEmails(nextDeletedEmails);
    setCampaigns((prev) => {
      const existingIds = new Set(prev.map((campaign) => campaign.id));
      const restoredCampaigns = deletedUserUndoState.removedCampaigns.filter((campaign) => !existingIds.has(campaign.id));
      return [...restoredCampaigns, ...prev];
    });

    clearDeletedUserUndoTimer();
    setDeletedUserUndoState(null);
  };

  const createWithdrawalRequest = (campaignId: number, amount: number, note: string, requestedByName: string, requestedByEmail: string) => {
    const campaign = campaigns.find((item) => item.id === campaignId);

    if (!campaign || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const now = Date.now();
    const nextRequest: WithdrawalRequest = {
      id: now,
      campaignId,
      campaignTitle: campaign.title,
      requestedByName,
      requestedByEmail,
      amount,
      note,
      status: 'Pending',
      createdAt: now,
      updatedAt: now
    };

    setWithdrawalRequests((prev) => [nextRequest, ...prev]);
  };

    const updateWithdrawalRequestStatus = (requestId: number, status: WithdrawalStatus) => {
      // Get the withdrawal request before updating to check previous status
      const withdrawal = withdrawalRequests.find((r) => r.id === requestId);
      const previousStatus = withdrawal?.status;

      setWithdrawalRequests((prev) => prev.map((request) => (
        request.id === requestId
          ? { ...request, status, updatedAt: Date.now() }
          : request
      )));

      if (withdrawal) {
        // If changing to Success, call backend to persist and decrease collected amount
        if (status === 'Success' && previousStatus !== 'Success') {
          (async () => {
            try {
              const res = await fetch(apiUrl(`/api/admin/withdrawals/${requestId}/approve`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: withdrawal.campaignId, amount: withdrawal.amount, note: withdrawal.note })
              });

              if (!res.ok) {
                console.error('Approve withdrawal failed', await res.text());
                // revert local status change
                setWithdrawalRequests((prev) => prev.map((req) => req.id === requestId ? { ...req, status: previousStatus || 'Pending' } : req));
                return;
              }

              const data = await res.json();
              if (data && data.campaign) {
                // update campaigns from server response
                setCampaigns((prev) => prev.map((c) => c.id === data.campaign.id ? ({ ...c, ...data.campaign }) : c));
              } else {
                // fallback local update
                setCampaigns((prev) => prev.map((campaign) =>
                  campaign.id === withdrawal.campaignId
                    ? { ...campaign, collected: Math.max(0, campaign.collected - withdrawal.amount) }
                    : campaign
                ));
              }
            } catch (err) {
              console.error('Failed to call approve endpoint', err);
              setWithdrawalRequests((prev) => prev.map((req) => req.id === requestId ? { ...req, status: previousStatus || 'Pending' } : req));
            }
          })();
        }
        // If changing to Rejected from Success, return the amount locally (no backend action)
        else if (status === 'Rejected' && previousStatus === 'Success') {
          setCampaigns((prev) =>
            prev.map((campaign) =>
              campaign.id === withdrawal.campaignId
                ? { ...campaign, collected: campaign.collected + withdrawal.amount }
                : campaign
            )
          );
        }
      }
    };

  const updateCampaignStatusOnServer = async (campaignId: number, status: CampaignStatus) => {
    const response = await fetch(apiUrl(`/api/campaigns/${campaignId}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Gagal memperbarui status kampanye');
    }

    return response.json();
  };

    const clearProcessedWithdrawals = () => {
      setWithdrawalRequests((prev) => prev.filter((r) => r.status !== 'Success' && r.status !== 'Rejected'));
    };

  // Filter & sort logic
  let filteredCampaigns = campaignsForDisplay;
  filteredCampaigns = filteredCampaigns.filter(campaign => campaign.status !== 'pending' && campaign.status !== 'rejected');
  if (selectedCategory !== 'Semua Kategori') {
    filteredCampaigns = filteredCampaigns.filter(c => c.category.includes(selectedCategory));
  }
  if (sortBy === 'Terbaru') {
    filteredCampaigns = [...filteredCampaigns].sort((a, b) => (b.createdAt ?? b.id) - (a.createdAt ?? a.id));
  } else if (sortBy === 'Paling Mendesak') {
    filteredCampaigns = [...filteredCampaigns].sort((a, b) => a.daysLeft - b.daysLeft);
  } else if (sortBy === 'Hampir Tercapai') {
    filteredCampaigns = [...filteredCampaigns].sort((a, b) => (b.collected / b.target) - (a.collected / a.target));
  }

  const prioritizedCampaignIds = new Set([1, 2, 3, 4, 5, 6]);
  const prioritizedCampaigns = filteredCampaigns.filter((campaign) => prioritizedCampaignIds.has(campaign.id));
  const otherCampaigns = filteredCampaigns.filter((campaign) => !prioritizedCampaignIds.has(campaign.id));
  filteredCampaigns = [...prioritizedCampaigns, ...otherCampaigns];

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const goToPublicCampaignPage = (nextPage: number) => {
    if (nextPage === currentPage) {
      return;
    }

    if (campaignPageTransitionTimerRef.current) {
      window.clearTimeout(campaignPageTransitionTimerRef.current);
    }

    setCampaignListFadeOut(true);
    campaignPageTransitionTimerRef.current = window.setTimeout(() => {
      setCurrentPage(nextPage);
      window.requestAnimationFrame(() => {
        setCampaignListFadeOut(false);
        if (campaignListTopRef.current) {
          const scrollTarget = campaignListTopRef.current.getBoundingClientRect().top + window.scrollY - 170;
          window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }
      });
      campaignPageTransitionTimerRef.current = null;
    }, 220);
  };

  // Reset page when filters or campaigns change
  useEffect(() => {
    setCurrentPage(1);
    setCampaignListFadeOut(false);
  }, [selectedCategory, sortBy]);

  useEffect(() => {
    if (currentPage <= totalPages) {
      return;
    }

    setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  useEffect(() => () => {
    if (campaignPageTransitionTimerRef.current) {
      window.clearTimeout(campaignPageTransitionTimerRef.current);
      campaignPageTransitionTimerRef.current = null;
    }
  }, []);

  // handle special scroll/navigation pages
  useEffect(() => {
    if (page === 'cara-kerja') {
      const el = document.getElementById('cara-kerja');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setPage(null);
    }

    if (page === 'kampanye') {
      const el = document.getElementById('kampanye');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setPage(null);
    }

    if (page === 'buat-kampanye') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [page]);

  const selectedCampaignData = selectedCampaignSource === 'snapshot'
    && selectedCampaignSnapshotRef.current?.id === selectedCampaign
    && Boolean((selectedCampaignSnapshotRef.current as any)?.localOnly)
    ? selectedCampaignSnapshotRef.current
    : campaigns.find(c => c.id === selectedCampaign) ?? (selectedCampaignSnapshotRef.current?.id === selectedCampaign ? selectedCampaignSnapshotRef.current : null);

  useEffect(() => {
    if (!selectedCampaign || selectedCampaignSource === 'snapshot') {
      return;
    }

    let cancelled = false;

    const fetchCampaignDetail = async () => {
      try {
        const response = await fetch(apiUrl(`/api/campaigns/${selectedCampaign}?_=${Date.now()}`), { cache: 'no-store' });
        if (!response.ok || cancelled) {
          return;
        }

        const campaignData = await response.json();
        const normalizedCampaign = normalizeCampaignRecord(campaignData);

        setCampaigns((prev) => {
          const index = prev.findIndex((campaign) => campaign.id === normalizedCampaign.id);
          if (index === -1) {
            return [...prev, normalizedCampaign];
          }

          const existing = prev[index];
          if (existing.collected === normalizedCampaign.collected && existing.donors === normalizedCampaign.donors) {
            return prev;
          }

          const next = [...prev];
          next[index] = normalizedCampaign;
          return next;
        });
      } catch {
        // ignore failures and keep current campaign data
      }
    };

    void fetchCampaignDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedCampaign, selectedCampaignSource]);

  useEffect(() => {
    if (selectedCampaign) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedCampaign]);

  useEffect(() => {
    setProfileEditName(user?.name ?? '');
    setProfileEditMessage('');
  }, [user?.email, user?.name, page]);

  // Assign any pending payments without ownerEmail to the logged-in user
  useEffect(() => {
    if (!user?.email) return;

    try {
      const raw = window.localStorage.getItem(pendingPaymentsKey) || '[]';
      const parsed = JSON.parse(raw) as PendingPaymentRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      let changed = false;
      const next = parsed.map((p) => {
        if (!p.ownerEmail) {
          changed = true;
          return { ...p, ownerEmail: user.email };
        }
        return p;
      });

      if (changed) {
        window.localStorage.setItem(pendingPaymentsKey, JSON.stringify(next));
        // update local state too so UI updates immediately
        setPendingPayments(next);
        // dispatch storage event for other tabs/components
        window.dispatchEvent(new StorageEvent('storage', { key: pendingPaymentsKey, newValue: JSON.stringify(next) }));
      }
    } catch (err) {
      // ignore
    }
  }, [user?.email]);

  const regularSiteZoomStyle = {
  };

  // Routing utama
  if (page === 'donasi-saya') {
    return (
      <div style={regularSiteZoomStyle}>
        <>
        <Navbar
          onNavigate={navigatePage}
          onHome={goHome}
          user={user}
          onLogout={() => setUser(null)}
          pendingPayments={visiblePendingPayments}
          onOpenPendingPayment={openPendingPayment}
        />
        <DonasiSaya
          user={user}
          onLogin={() => navigatePage('login')}
          donations={donationHistoryForDisplay}
        />
        <Chatbot />
        </>
      </div>
    );
  }
  if (selectedCampaignData) {
    return (
      <div style={regularSiteZoomStyle}>
        <>
        <Navbar
          onNavigate={navigatePage}
          onHome={goHome}
          user={user}
          onLogout={() => setUser(null)}
          pendingPayments={visiblePendingPayments}
          onOpenPendingPayment={openPendingPayment}
        />
        <CampaignDetail
          campaign={selectedCampaignData}
          user={user}
          withdrawalRequests={withdrawalRequests}
          onBack={closeCampaign}
          onRequestWithdrawal={(campaignId, request) => {
            if (!user?.email) {
              return;
            }

            createWithdrawalRequest(campaignId, request.amount, request.note, user.name, user.email);
          }}
          onUpdateCampaign={async (campaignId, updates) => {
            const response = await fetch(apiUrl(`/api/campaigns/${campaignId}`), {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token') || ''}`
              },
              body: JSON.stringify({
                ...updates,
                creatorEmail: user?.email || updates.creatorEmail || selectedCampaignData.creatorEmail || ''
              })
            });

            if (!response.ok) {
              const body = await response.json().catch(() => ({}));
              throw new Error(body.error || 'Gagal menyimpan perubahan kampanye');
            }

            const updatedCampaign = normalizeCampaignRecord(await response.json());

            setCampaigns((prev) => prev.map((campaign) => (
              campaign.id === campaignId ? ({ ...campaign, ...updatedCampaign, ...updates } as CampaignRecord) : campaign
            )));

            selectedCampaignSnapshotRef.current = null;
            setSelectedCampaignSource('id');
            void syncCampaignsFromServer();
          }}
          onDonationSuccess={(amount, donorInfo) => {
            selectedCampaignSnapshotRef.current = null;
            setSelectedCampaignSource('id');
            setCampaigns((prev) => {
              const nextCampaigns = prev.map((campaign) => (
                campaign.id === selectedCampaignData.id
                  ? {
                      ...campaign,
                      collected: campaign.collected + amount,
                      donors: campaign.donors + 1,
                      donations: [
                        ...(campaign.donations || []),
                        {
                          name: donorInfo.name,
                          amount: amount,
                          // include owner/email so DonasiSaya can identify user's donations
                          ownerEmail: user?.email || undefined,
                          email: user?.email || undefined,
                          tip: donorInfo.tip || 0,
                          message: donorInfo.message,
                          timestamp: Date.now()
                        }
                      ]
                    }
                  : campaign
              ));

              // Create a snapshot of the updated campaign so the detail view shows
              // the newly-applied local donation immediately and does not flash back
              const updated = nextCampaigns.find(c => c.id === selectedCampaignData.id);
              if (updated) {
                selectedCampaignSnapshotRef.current = { ...updated, localOnly: true } as any;
                setSelectedCampaignSource('snapshot');
              }

              try {
                window.localStorage.setItem(campaignStorageKey, JSON.stringify(nextCampaigns));
                window.localStorage.setItem(campaignUpdatedEventKey, String(Date.now()));
              } catch {
                // ignore localStorage write failures
              }

              void syncCampaignsFromServer(undefined, [], nextCampaigns);
              return nextCampaigns;
            });
          }}
          onNavigateToContinuePayment={openPendingPayment}
        />
        <Chatbot />
        </>
      </div>
    );
  }
  if (page === 'login') {
    return (
      <div style={regularSiteZoomStyle}>
        <>
        <Navbar
          onNavigate={navigatePage}
          onHome={goHome}
          user={user}
          onLogout={() => setUser(null)}
          pendingPayments={visiblePendingPayments}
          onOpenPendingPayment={openPendingPayment}
        />
        <LoginRegister onLogin={(u) => {
          setUser(u);
          setRegisteredUsers(loadRegisteredUsersFromStorage());
          goHome();
        }} />
        </>
      </div>
    );
  }
  if (page === 'lanjut-pembayaran') {
    return (
      <div style={regularSiteZoomStyle}>
        <ContinuePaymentPage onHome={goHome} user={user} />
      </div>
    );
  }
  if (page === 'admin-login' || (page === 'admin' && !adminUser)) {
    return (
      <AdminLogin
        onLogin={(admin) => {
          setAdminUser(admin);
          window.localStorage.setItem(adminSessionKey, JSON.stringify(admin));
          navigatePage('admin');
          void syncCampaignsFromServer();
        }}
      />
    );
  }
  if (page === 'buat-kampanye') {
    return (
      <div style={regularSiteZoomStyle}>
        <>
        <Navbar
          onNavigate={navigatePage}
          onHome={goHome}
          user={user}
          onLogout={() => setUser(null)}
          pendingPayments={visiblePendingPayments}
          onOpenPendingPayment={openPendingPayment}
        />
        <div className="max-w-md mx-auto py-12 px-4">
          <h2 className="text-2xl font-bold mb-4">Buat Kampanye</h2>
          <CreateCampaign
            user={user}
            onCreate={(c) => {
              const normalizedCampaign: CampaignRecord = {
                ...c,
                createdAt: c.createdAt ?? Date.now(),
                fullDescription: c.fullDescription || c.story || c.description,
                story: c.story || c.fullDescription || c.description,
                image: c.image || '',
                fundAllocation: Array.isArray(c.fundAllocation) ? c.fundAllocation : [],
                disbursementHistory: Array.isArray(c.disbursementHistory) ? c.disbursementHistory : [],
                donations: Array.isArray(c.donations) ? c.donations : []
              };

              const useSnapshotSource = Boolean((c as any).localOnly);

              selectedCampaignSnapshotRef.current = useSnapshotSource ? normalizedCampaign : null;
              setCampaigns((prev) => [...prev, normalizedCampaign]);
              setSelectedCampaign(normalizedCampaign.id);
              setSelectedCampaignSource(useSnapshotSource ? 'snapshot' : 'id');
              setPage(null);
              window.history.pushState(
                { view: 'campaign', campaignId: normalizedCampaign.id },
                '',
                `/?campaign=${normalizedCampaign.id}`
              );
            }}
          />
        </div>
        </>
      </div>
    );
  }
  if (page && ['tentang-kami', 'syarat-ketentuan', 'kebijakan-privasi', 'faq', 'hubungi-kami', 'panduan-donatur', 'panduan-penggalang'].includes(page)) {
    return (
      <div style={regularSiteZoomStyle}>
        <InfoPage page={page as InfoPageKey} onNavigate={navigatePage} onHome={goHome} />
      </div>
    );
  }
  if (page === 'panel') {
    const userCampaigns = user?.email ? campaigns.filter((campaign) => campaign.creatorEmail === user.email) : [];

    return (
      <div style={regularSiteZoomStyle}>
        <>
        <Navbar
          onNavigate={navigatePage}
          onHome={goHome}
          user={user}
          onLogout={() => setUser(null)}
          pendingPayments={visiblePendingPayments}
          onOpenPendingPayment={openPendingPayment}
        />
        <div className="max-w-4xl mx-auto py-12 px-4">
          <h2 className="text-2xl font-bold mb-4">Panel User</h2>
          {user ? (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <p className="text-sm text-gray-500">Profil Saya</p>
                  <h3 className="mt-1 text-xl font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.email || '-'}</p>

                  <div className="mt-5 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Edit nama akun</label>
                    <input
                      type="text"
                      value={profileEditName}
                      onChange={(event) => setProfileEditName(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="Masukkan nama baru"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => updateCurrentUserName(profileEditName)}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                      >
                        Simpan Nama
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileEditName(user.name)}
                        className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Reset
                      </button>
                    </div>
                    {profileEditMessage && <p className="text-sm text-emerald-600">{profileEditMessage}</p>}
                  </div>

                  {recurringDonationStatus && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-800">Status Donasi Rutin</p>
                      <p className="mt-1 text-sm text-emerald-700">
                        Anda adalah donatur rutin aktif untuk {recurringDonationStatus.campaignTitle}.
                      </p>
                      <p className="mt-2 text-xs text-emerald-600">
                        Nominal bulanan: Rp {Number(recurringDonationStatus.amount || 0).toLocaleString('id-ID')}
                      </p>
                        <div className="mt-3">
                          <button
                            onClick={() => {
                              if (!user?.email) {
                                alert('Anda harus login untuk mengelola donasi rutin.');
                                return;
                              }
                              const ok = confirm('Hentikan donasi rutin untuk kampanye ini?');
                              if (!ok) return;
                              try {
                                const raw = localStorage.getItem('bantusesama-recurring-donors') || '[]';
                                const records: Array<any> = JSON.parse(raw || '[]');
                                const filtered = records.filter((r) => r.email.toLowerCase() !== user.email!.toLowerCase());
                                localStorage.setItem('bantusesama-recurring-donors', JSON.stringify(filtered));
                                // force re-render to refresh recurring status
                                setRecurringToggle((v) => v + 1);
                                alert('Donasi rutin berhasil dihentikan.');
                              } catch (err) {
                                alert('Gagal menghentikan donasi rutin. Coba lagi.');
                              }
                            }}
                            className="mt-3 px-3 py-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Hentikan Donasi Rutin
                          </button>
                        </div>
                    </div>
                  )}
                </div>

                {visiblePendingPayments.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                    <p className="text-sm text-amber-700">Pembayaran Pending</p>
                    <h3 className="mt-1 text-xl font-semibold text-amber-900">{visiblePendingPayments.length} transaksi</h3>
                    <p className="mt-2 text-sm text-amber-800">
                      Gunakan ikon profil di kanan atas untuk membuka notifikasi dan melanjutkan pembayaran.
                    </p>
                    <button onClick={() => navigatePage('lanjut-pembayaran')} className="mt-5 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700">
                      Buka Halaman Lanjut Bayar
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => navigatePage('donasi-saya')} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Lihat Donasi Saya</button>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Kampanye Saya</h3>
                {userCampaigns.length === 0 ? (
                  <p className="text-gray-600">Belum ada kampanye yang dibuat.</p>
                ) : (
                  <div className="space-y-3">
                    {userCampaigns.map((campaign) => (
                      <div key={campaign.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
                        <div>
                          <p className="font-medium text-gray-900">{campaign.title}</p>
                          <p className="text-sm text-gray-600">Deadline {campaign.daysLeft} hari lagi</p>
                        </div>
                        <button onClick={() => openCampaign(campaign.id)} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                          Buka & Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p>Silakan login terlebih dahulu.</p>
          )}
        </div>
        </>
      </div>
    );
  }
  if (page === 'admin') {
    return (
      <>
        {rejectUndoState && (
          <div className="fixed top-20 left-0 right-0 z-50 mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <div className="max-w-7xl w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 flex items-center justify-between gap-3">
              <span>
                Kampanye ditolak. Undo tersedia {Math.max(0, Math.ceil((rejectUndoState.expiresAt - undoNow) / 1000))} detik.
              </span>
              <button
                onClick={undoRejectCampaign}
                className="px-3 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                Undo
              </button>
            </div>
          </div>
        )}
        {deletedUserUndoState && false && (
          <div className="fixed top-20 left-0 right-0 z-50 mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <div className="max-w-7xl w-full rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900 flex items-center justify-between gap-3">
              <span>
                User {deletedUserUndoState?.email} dihapus. Undo tersedia {Math.max(0, Math.ceil(((deletedUserUndoState?.expiresAt ?? 0) - undoNow) / 1000))} detik.
              </span>
              <button
                onClick={undoDeletedUser}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                Undo
              </button>
            </div>
          </div>
        )}
        <AdminDashboard
          campaigns={campaigns.filter((c) => !legacyPaginationMockTitles.has(toSafeText(c.title)))}
          users={adminUsers}
          withdrawalRequests={withdrawalRequests}
          user={adminUser}
          onVerifyCampaign={(campaignId) => {
            void (async () => {
              clearRejectUndoTimer();
              setRejectUndoState(null);

              const nextHiddenRejectedIds = hiddenRejectedCampaignIds.filter((id) => id !== campaignId);
              if (nextHiddenRejectedIds.length !== hiddenRejectedCampaignIds.length) {
                setHiddenRejectedCampaignIds(nextHiddenRejectedIds);
                saveHiddenRejectedCampaignIdsToStorage(nextHiddenRejectedIds);
              }

              try {
                await updateCampaignStatusOnServer(campaignId, 'verified');
                await syncCampaignsFromServer();
                try {
                  window.localStorage.setItem(campaignUpdatedEventKey, String(Date.now()));
                } catch {
                  // ignore write failures
                }
              } catch (err) {
                console.error(err);

                // Fallback local update when backend is temporarily unreachable.
                setCampaigns((prev) => {
                  const next = prev.map((campaign) => (
                    campaign.id === campaignId
                      ? { ...campaign, status: 'verified' as CampaignStatus }
                      : campaign
                  ));

                  try {
                    window.localStorage.setItem(campaignStorageKey, JSON.stringify(next));
                  } catch {
                    // ignore write failures
                  }

                  return next;
                });

                try {
                  window.localStorage.setItem(campaignUpdatedEventKey, String(Date.now()));
                } catch {
                  // ignore write failures
                }

                window.alert('Server belum merespons. Status kampanye disimpan lokal sebagai terverifikasi.');
              }
            })();
          }}
          onRejectCampaign={(campaignId) => {
            const previousCampaign = campaigns.find((campaign) => campaign.id === campaignId);
            const nextHiddenRejectedIds = hiddenRejectedCampaignIds.includes(campaignId)
              ? hiddenRejectedCampaignIds
              : [...hiddenRejectedCampaignIds, campaignId];
            const nextHiddenDemoIds = hiddenDemoCampaignIds;

            void (async () => {
              try {
                console.log(`[Reject] Menolak kampanye ${campaignId}...`);
                const statusUpdateResult = await updateCampaignStatusOnServer(campaignId, 'rejected');
                console.log(`[Reject] Status update result:`, statusUpdateResult);

                const nextCampaigns = campaigns.filter((campaign) => campaign.id !== campaignId);
                setCampaigns(nextCampaigns);
                try {
                  window.localStorage.setItem(campaignStorageKey, JSON.stringify(nextCampaigns));
                } catch {
                  // ignore write failures
                }

                setHiddenRejectedCampaignIds(nextHiddenRejectedIds);
                saveHiddenRejectedCampaignIdsToStorage(nextHiddenRejectedIds);

                startRejectUndo(campaignId, previousCampaign);

                // Refresh from server to ensure public campaigns are consistent with DB.
                const syncSuccess = await syncCampaignsFromServer(undefined, nextHiddenDemoIds);
                console.log(`[Reject] Sync success:`, syncSuccess);
                if (!syncSuccess) {
                  console.warn('Sync dari server gagal, mencoba sync ulang...');
                  await new Promise((resolve) => window.setTimeout(resolve, 500));
                  await syncCampaignsFromServer(undefined, nextHiddenDemoIds);
                }

                try {
                  window.localStorage.setItem(campaignUpdatedEventKey, String(Date.now()));
                } catch {
                  // ignore write failures
                }
              } catch (err) {
                console.error('Error menolak kampanye:', err);

                // Fallback local reject so campaign does not reappear on refresh.
                const nextCampaigns = campaigns.filter((campaign) => campaign.id !== campaignId);
                setCampaigns(nextCampaigns);
                try {
                  window.localStorage.setItem(campaignStorageKey, JSON.stringify(nextCampaigns));
                } catch {
                  // ignore write failures
                }

                setHiddenRejectedCampaignIds(nextHiddenRejectedIds);
                saveHiddenRejectedCampaignIdsToStorage(nextHiddenRejectedIds);
                startRejectUndo(campaignId, previousCampaign);

                try {
                  window.localStorage.setItem(campaignUpdatedEventKey, String(Date.now()));
                } catch {
                  // ignore write failures
                }

                window.alert('Server belum merespons. Kampanye disembunyikan lokal sebagai ditolak.');
              }
            })();
          }}
          onUpdateWithdrawalStatus={updateWithdrawalRequestStatus}
          onClearWithdrawals={clearProcessedWithdrawals}
          onLogout={() => {
            setAdminUser(null);
            window.localStorage.removeItem(adminSessionKey);
            navigatePage('admin-login');
          }}
          onDeleteUser={(email) => {
            const normalizedEmail = normalizeEmail(email);
            console.log('[DEBUG] onDeleteUser start:', { email, normalizedEmail, currentDeletedUserEmails: deletedUserEmails });
            
            const filteredUsers = registeredUsers.filter((account) => normalizeEmail(account.email) !== normalizedEmail);
            setRegisteredUsers(filteredUsers);
            try {
              window.localStorage.setItem(registeredUsersKey, JSON.stringify(filteredUsers));
            } catch {
              // ignore write failures
            }

            const nextDeletedEmails = deletedUserEmails.includes(normalizedEmail)
              ? deletedUserEmails
              : [...deletedUserEmails, normalizedEmail];
            console.log('[DEBUG] onDeleteUser nextDeletedEmails:', { nextDeletedEmails });
            
            setDeletedUserEmails(nextDeletedEmails);
            saveDeletedUserEmailsToStorage(nextDeletedEmails);
            setServerUsers((prev) => prev.filter((account) => normalizeEmail(account.email) !== normalizedEmail));
            setCampaigns((prev) => prev.filter((campaign) => normalizeEmail(campaign.creatorEmail) !== normalizedEmail));
            
            window.alert('User ' + email + ' berhasil dihapus permanen.');
          }}
        />
      </>
    );
  }
  return (
    <div style={regularSiteZoomStyle}>
      <div className="min-h-screen bg-gray-50">
      <Navbar
        onNavigate={navigatePage}
        onHome={goHome}
        user={user}
        onLogout={() => setUser(null)}
        pendingPayments={visiblePendingPayments}
        onOpenPendingPayment={openPendingPayment}
      />

      <section className="relative bg-gradient-to-br from-blue-600 to-blue-700 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1559027615-cd4628902d4a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="Community helping"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h1 className="font-bold text-4xl md:text-5xl mb-6">
                Wujudkan bantuan cepat untuk mereka yang paling membutuhkan
              </h1>
              <p className="text-xl text-blue-50 mb-8">
                Platform crowdfunding dengan transparansi penuh untuk membantu UMKM yang terdampak bencana
              </p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => navigatePage('kampanye')} className="px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium">
                  Mulai Donasi
                </button>
                <button onClick={() => navigatePage('buat-kampanye')} className="px-8 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-blue-600 font-medium">
                  Buat Kampanye
                </button>
              </div>
            </div>
            <div className="hidden md:block">
              <img
                src="https://images.unsplash.com/photo-1593113598332-cd288d649433?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
                alt="Helping hands"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Rp 125 Juta+</h3>
              <p className="text-blue-50">Total Dana Terkumpul</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1,250+ Donatur</h3>
              <p className="text-blue-50">Orang Sudah Berdonasi</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">95 UMKM</h3>
              <p className="text-blue-50">Telah Terbantu</p>
            </div>
          </div>
        </div>
      </section>

      <section id="kampanye" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="font-bold text-3xl text-gray-900 mb-2">Kampanye Mendesak</h2>
              <p className="text-gray-600">UMKM yang membutuhkan bantuan Anda segera</p>
            </div>
            <div className="flex gap-2">
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option>Semua Kategori</option>
                <option>UMKM Terdampak Bencana</option>
                <option>Kesehatan</option>
                <option>Pendidikan</option>
                <option>Kemanusiaan</option>
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option>Terbaru</option>
                <option>Paling Mendesak</option>
                <option>Hampir Tercapai</option>
              </select>

            </div>

          {/* Tip widget moved to Navbar dropdown */}
          </div>

          <div ref={campaignListTopRef} className={`grid md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${campaignListFadeOut ? 'opacity-0' : 'opacity-100'}`}>
            {paginatedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                {...campaign}
                onClick={() => openCampaign(campaign.id)}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center space-x-3">
            <button
              onClick={() => goToPublicCampaignPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-md border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}>
              Prev
            </button>

            <nav className="flex items-center space-x-2" aria-label="Pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => goToPublicCampaignPage(n)}
                  aria-current={currentPage === n ? 'page' : undefined}
                  className={`px-3 py-2 rounded-md border ${currentPage === n ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'}`}>
                  {n}
                </button>
              ))}
            </nav>

            <button
              onClick={() => goToPublicCampaignPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 rounded-md border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}>
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="bg-blue-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-bold text-3xl text-gray-900 mb-4">Mengapa BantuSesama?</h2>
            <p className="text-gray-600">Kepercayaan adalah prioritas kami</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-gray-900">100% Transparan</h3>
              <p className="text-gray-600">
                Setiap rupiah yang masuk dan keluar tercatat dengan jelas. Lihat laporan penggunaan dana secara real-time.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-gray-900">Terverifikasi</h3>
              <p className="text-gray-600">
                Semua kampanye diverifikasi tim kami. Kami memastikan dana sampai ke tangan yang tepat.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-gray-900">Donasi Rutin</h3>
              <p className="text-gray-600">
                Aktifkan donasi rutin bulanan untuk membantu UMKM secara berkelanjutan dan otomatis.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-bold text-3xl text-gray-900 mb-4">Cara Kerja</h2>
            <p className="text-gray-600">Mudah dan cepat untuk membantu sesama</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Pilih Kampanye', desc: 'Browse kampanye UMKM yang membutuhkan bantuan' },
              { step: '2', title: 'Tentukan Nominal', desc: 'Pilih jumlah donasi yang ingin diberikan' },
              { step: '3', title: 'Bayar Aman', desc: 'Gunakan payment gateway terpercaya' },
              { step: '4', title: 'Pantau Transparansi', desc: 'Lihat laporan penggunaan dana secara real-time' }
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2 text-gray-900">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="20" fill="#3B82F6"/>
                  <path d="M20 8L12 16H16V24H14L20 32L26 24H24V16H28L20 8Z" fill="white"/>
                  <circle cx="20" cy="20" r="3" fill="#FCD34D"/>
                </svg>
                <span className="font-bold text-xl">BantuSesama</span>
              </div>
              <p className="text-gray-400 text-sm">
                Platform crowdfunding dengan transparansi penuh untuk UMKM terdampak bencana
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Tentang</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('tentang-kami')}>Tentang Kami</button></li>
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('syarat-ketentuan')}>Syarat & Ketentuan</button></li>
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('kebijakan-privasi')}>Kebijakan Privasi</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Bantuan</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('faq')}>FAQ</button></li>
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('hubungi-kami')}>Hubungi Kami</button></li>
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('panduan-donatur')}>Panduan Donatur</button></li>
                <li><button type="button" className="hover:text-white" onClick={() => navigatePage('panduan-penggalang')}>Panduan Penggalang</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Kontak</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Email: info@bantusesama.id</li>
                <li>Telepon: (021) 1234-5678</li>
                <li>WhatsApp: 0812-3456-7890</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2026 BantuSesama. Semua hak dilindungi.</p>
          </div>
        </div>
      </footer>

      <Chatbot />
      {/* Dokumentasi component removed */}
    </div>
    </div>
  );
}