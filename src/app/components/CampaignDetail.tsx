import { ImageWithFallback } from './ImageWithFallback';
import { MapPin, Users, Calendar, Share2, Heart, TrendingUp, Shield, FileText, Facebook, Twitter, Send, Mail, Link2, MessageCircle } from 'lucide-react';
import { TransparencyChart } from './TransparencyChart';
import { useEffect, useMemo, useState, useRef } from 'react';
import { PaymentModal } from './PaymentModal';
import { apiUrl, getApiBaseUrl } from '../lib/apiBaseUrl';

interface Campaign {
  id: number;
  creatorEmail?: string;
  title: string;
  description: string;
  fullDescription: string;
  image: string;
  location: string;
  target: number;
  collected: number;
  donors: number;
  daysLeft: number;
  category: string;
  organizer: string;
  story: string;
  fundAllocation: Array<{name: string; value: number; color: string}>;
  disbursementHistory: Array<{date: string; amount: number; purpose: string}>;
  donations?: Array<{name: string; amount: number; message: string; timestamp: number}>;
}

interface CampaignDetailProps {
  campaign: Campaign;
  withdrawalRequests?: Array<{id: number; campaignId: number; amount: number; status: string; updatedAt: number; note?: string}>;
  user?: { name: string; email?: string } | null;
  onBack: () => void;
  onUpdateCampaign?: (campaignId: number, updates: Partial<Campaign>) => void;
  onRequestWithdrawal?: (campaignId: number, request: { amount: number; note: string }) => void;
  onDonationSuccess?: (amount: number, donorInfo: {name: string; message: string; tip?: number}) => void;
  onNavigateToContinuePayment?: (payment: {
    donationId: number;
    orderId: string;
    campaignTitle: string;
    amount: number;
    method: 'virtual_account' | 'ewallet';
    redirectUrl?: string;
  }) => void;
}

type AllocationEditorItem = { name: string; value: string; color: string };
type DisbursementEditorItem = { date: string; amount: string; purpose: string };

const locationOptions = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Bengkulu',
  'Lampung',
  'DKI Jakarta',
  'Jawa Barat',
  'Banten',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Gorontalo',
  'Sulawesi Tengah',
  'Sulawesi Barat',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Barat Daya',
  'Papua Selatan',
  'Papua Tengah',
  'Papua Pegunungan'
];
const toAllocationEditorItems = (items: Campaign['fundAllocation']): AllocationEditorItem[] => (
  items.length > 0
    ? items.map((item) => ({ name: item.name, value: String(item.value), color: item.color }))
    : [{ name: '', value: '', color: '#10B981' }]
);

const toDisbursementEditorItems = (items: Campaign['disbursementHistory']): DisbursementEditorItem[] => (
  items.length > 0
    ? items.map((item) => ({ date: item.date, amount: String(item.amount), purpose: item.purpose }))
    : [{ date: '', amount: '', purpose: '' }]
);

const toCampaignAllocations = (items: AllocationEditorItem[]) => (
  items
    .map((item) => ({
      name: item.name.trim(),
      value: Number(item.value),
      color: item.color.trim() || '#10B981'
    }))
    .filter((item) => item.name && Number.isFinite(item.value) && item.value > 0)
);

const toCampaignDisbursements = (items: DisbursementEditorItem[]) => (
  items
    .map((item) => ({
      date: item.date.trim(),
      amount: Number(item.amount),
      purpose: item.purpose.trim()
    }))
    .filter((item) => item.date && Number.isFinite(item.amount) && item.amount >= 0 && item.purpose)
);

const formatNumberWithSeparators = (value: string) => {
  if (!value) {
    return '';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('id-ID') : value;
};

export function CampaignDetail({ campaign, user, onBack, onUpdateCampaign, onRequestWithdrawal, onDonationSuccess, onNavigateToContinuePayment, withdrawalRequests }: CampaignDetailProps) {
  // Compute combined disbursement history (campaign + successful withdrawals)
  const computedDisbursementHistory = (() => {
    if (!withdrawalRequests) {
      return campaign.disbursementHistory;
    }
    const successfulWithdrawals = withdrawalRequests
      .filter(w => w.campaignId === campaign.id && w.status === 'Success')
      .map(w => ({
        date: new Date(w.updatedAt).toLocaleDateString('id-ID', {
          year: 'numeric' as const,
          month: 'long' as const,
          day: 'numeric' as const
        }),
        amount: w.amount,
        purpose: w.note || `Pencairan dana ke penggalang`
      }));
    return [...campaign.disbursementHistory, ...successfulWithdrawals];
  })();
  const [activeTab, setActiveTab] = useState<'story' | 'transparency' | 'donors'>('story');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const [isRecurringActive, setIsRecurringActive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [editTitle, setEditTitle] = useState(campaign.title);
  const [editLocation, setEditLocation] = useState(campaign.location);
  const effectiveTarget = campaign.target > 0 ? campaign.target : (campaign.goal ?? 0);
  const [editTarget, setEditTarget] = useState(String(effectiveTarget));
  const [editDaysLeft, setEditDaysLeft] = useState(String(campaign.daysLeft));
  const [editStory, setEditStory] = useState(campaign.story);
  const [editImage, setEditImage] = useState(campaign.image);
  const [editAllocations, setEditAllocations] = useState<AllocationEditorItem[]>(toAllocationEditorItems(campaign.fundAllocation));
  const [editDisbursements, setEditDisbursements] = useState<DisbursementEditorItem[]>(toDisbursementEditorItems(campaign.disbursementHistory));
  const [editCategory, setEditCategory] = useState(campaign.category);
  const [editOrganizer, setEditOrganizer] = useState(campaign.organizer);
  const [withdrawAmount, setWithdrawAmount] = useState(String(campaign.collected));
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  
  // Apply same fallback logic as CampaignCard for demo data (must be before generateMockDonations)
  const filledTarget = campaign.target > 0 ? campaign.target : (campaign.goal ?? 5000000);
  const filledCollected = campaign.collected > 0 ? campaign.collected : Math.max(500000, Math.round(filledTarget * 0.15));
  const filledDonors = campaign.donors > 0 ? campaign.donors : 2;
  
  // Generate mock data berbeda untuk setiap campaign berdasarkan campaign ID
  const generateMockDonations = (campaignId: number) => {
    const donors = [
      'Siti Nurhaliza', 'Bambang Wijaya', 'Rina Sutrisno', 'Ahmad Suryanto', 'Dewi Lestari',
      'Rudi Hartono', 'Sinta Paramita', 'Doni Pratama', 'Ratna Wijaya', 'Hendri Kusuma',
      'Anita Soeharto', 'Budi Santoso', 'Citra Dewi', 'Eka Putra', 'Farah Nabila'
    ];
    const messages = [
      'Semoga bisa membantu', 'Perjuangan membutuhkan dukungan', 'Semoga berkah dan lancar',
      'Semangat terus!', 'Semoga lancar selalu', 'Bangkit dan berkembang', 'Untuk masa depan yang lebih baik',
      'Doa dan dukungan bersama'
    ];
    
    // Use campaign ID as seed untuk generate different data per campaign
    let seed = campaignId;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    const mockCount = filledDonors; // Use filled donors count
    const mockData = [];
    
    for (let i = 0; i < mockCount; i++) {
      const donorIdx = Math.floor(seededRandom() * donors.length);
      const messageIdx = Math.floor(seededRandom() * (messages.length + 1));
      const amount = (Math.floor(seededRandom() * 15) + 1) * 100000; // Rp 100k - 1.5jt
      const hoursAgo = Math.floor(seededRandom() * 72) + 1; // 1-72 jam lalu
      
      mockData.push({
        name: donors[donorIdx],
        amount: amount,
        message: messageIdx < messages.length ? messages[messageIdx] : '',
        timestamp: Date.now() - hoursAgo * 60 * 60 * 1000
      });
    }
    
    return mockData;
  };
  
  const mockDonations = useMemo(() => generateMockDonations(campaign.id), [campaign.id, filledDonors]);
  
  const [fetchedDonations, setFetchedDonations] = useState<Array<{name: string; amount: number; message: string; timestamp: number}> | null>(null);
  const [loadingDonations, setLoadingDonations] = useState(false);

  const percentage = filledTarget > 0 ? Math.min((filledCollected / filledTarget) * 100, 100) : 0;
  const canEdit = user?.email && campaign.creatorEmail && user.email.toLowerCase() === campaign.creatorEmail.toLowerCase();
  const isVerified = campaign.status !== 'pending' && campaign.status !== 'rejected';
  const statusLabel = campaign.status === 'pending'
    ? 'Menunggu Verifikasi'
    : campaign.status === 'rejected'
      ? 'Ditolak'
      : 'Terverifikasi';
  const statusDescription = campaign.status === 'pending'
    ? 'Kampanye sedang menunggu verifikasi dari tim BantuSesama'
    : campaign.status === 'rejected'
      ? 'Kampanye belum disetujui oleh tim BantuSesama'
      : 'Penggalang dana telah diverifikasi oleh tim BantuSesama';
  
  const getTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return days === 1 ? '1 hari lalu' : `${days} hari lalu`;
    if (hours > 0) return hours === 1 ? '1 jam lalu' : `${hours} jam lalu`;
    if (minutes > 0) return minutes === 1 ? '1 menit lalu' : `${minutes} menit lalu`;
    return 'baru saja';
  };
  
  const donorEntries = (() => {
    // Merge campaign.donations, fetchedDonations, and mockDonations so that
    // real donations appended by user do not replace the mock donors.
    const combined: Array<{name: string; amount: number; message: string; timestamp: number}> = [];

    if (Array.isArray(campaign.donations) && campaign.donations.length > 0) {
      combined.push(...campaign.donations);
    }
    if (Array.isArray(fetchedDonations) && fetchedDonations.length > 0) {
      combined.push(...fetchedDonations);
    }
    if (Array.isArray(mockDonations) && mockDonations.length > 0) {
      combined.push(...mockDonations);
    }

    if (combined.length === 0) return [];

    // Deduplicate by donor content and time bucket to avoid repeated mock/fetch entries
    const seen = new Set<string>();
    const unique = combined.filter(d => {
      const timeBucket = Math.floor(d.timestamp / (60 * 60 * 1000));
      const key = `${d.name.trim().toLowerCase()}|${d.amount}|${(d.message || '').trim().toLowerCase()}|${timeBucket}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => b.timestamp - a.timestamp);

    return unique.slice(0, 5).map(donation => ({
      name: donation.name,
      amount: donation.amount,
      message: donation.message,
      time: getTimeAgo(donation.timestamp)
    }));
  })();

  const syncEditState = () => {
    setEditError('');
    setEditTitle(campaign.title);
    setEditLocation(campaign.location);
    setEditTarget(String(campaign.target));
    setEditDaysLeft(String(campaign.daysLeft));
    setEditStory(campaign.story);
    setEditImage(campaign.image);
    setEditCategory(campaign.category);
    setEditOrganizer(campaign.organizer);
    setEditAllocations(toAllocationEditorItems(campaign.fundAllocation));
    setEditDisbursements(toDisbursementEditorItems(campaign.disbursementHistory));
  };

  useEffect(() => {
    setWithdrawAmount(String(campaign.collected));
    setWithdrawNote('');
    setWithdrawError('');
  }, [campaign.id, campaign.collected]);

  // Close share menu when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!showShareMenu) return;
      const target = e.target as Node | null;
      if (shareMenuRef.current && target && !shareMenuRef.current.contains(target)) {
        setShowShareMenu(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showShareMenu]);

  // Check if current user has an active recurring donation for this campaign
  useEffect(() => {
    try {
      if (!user?.email) {
        setIsRecurringActive(false);
        return;
      }
      const raw = localStorage.getItem('bantusesama-recurring-donors') || '[]';
      const records: Array<any> = JSON.parse(raw || '[]');
      const found = records.find((r) => r.email === user.email && Number(r.campaignId) === Number(campaign.id));
      setIsRecurringActive(Boolean(found));
    } catch (err) {
      setIsRecurringActive(false);
    }
  }, [user?.email, campaign.id]);

  // Fetch donations if not available but campaign has donors
  useEffect(() => {
    if (!campaign.donations || campaign.donations.length === 0) {
      if (campaign.donors > 0) {
        setLoadingDonations(true);
        (async () => {
            const apiBaseUrl = getApiBaseUrl();
          try {
            const res = await fetch(apiUrl(`/api/donations?campaignId=${campaign.id}`));
            if (!res.ok) {
              const text = await res.text().catch(() => '');
              console.error('Failed to fetch donations: non-OK response', res.status, text);
              setFetchedDonations([]);
              return;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              const text = await res.text().catch(() => '');
              console.error('Failed to fetch donations: expected JSON but got:', contentType, text.substring(0, 200));
              setFetchedDonations([]);
              return;
            }

            const data = await res.json().catch((err) => {
              console.error('Failed to parse donations JSON:', err);
              return null;
            });

            if (Array.isArray(data) && data.length > 0) {
              setFetchedDonations(data);
            } else {
              setFetchedDonations([]);
            }
          } catch (err) {
            console.error('Failed to fetch donations:', err);
            setFetchedDonations([]);
          } finally {
            setLoadingDonations(false);
          }
        })();
      }
    }
  }, [campaign.id, campaign.donors, campaign.donations]);

  const handleEditImageUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditImage(typeof reader.result === 'string' ? reader.result : campaign.image);
    };
    reader.readAsDataURL(file);
  };

  const handleStartEdit = () => {
    syncEditState();
    setIsEditing(true);
  };

  const showEditError = (message: string) => {
    setEditError(message);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleTargetChange = (event: { target: { value: string } }) => {
    setEditTarget(event.target.value.replace(/[^\d]/g, ''));
  };

  const handleWithdrawalRequest = () => {
    const amount = Number(withdrawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawError('Nominal pencairan harus diisi');
      return;
    }

    if (amount > campaign.collected) {
      setWithdrawError(`Nominal tidak boleh melebihi dana terkumpul (Rp ${campaign.collected.toLocaleString('id-ID')})`);
      return;
    }

    onRequestWithdrawal?.(campaign.id, {
      amount,
      note: withdrawNote.trim()
    });

    setWithdrawError('');
    setWithdrawNote('');
    setWithdrawAmount('');
  };

  const handleSaveEdit = () => {
    const nextTarget = Number(editTarget);
    const nextDaysLeft = Number(editDaysLeft);
    const nextAllocations = toCampaignAllocations(editAllocations);
    const nextDisbursements = toCampaignDisbursements(editDisbursements);

    if (!editTitle.trim()) {
      showEditError('Judul kampanye harus diisi');
      return;
    }

    if (!editLocation.trim()) {
      showEditError('Lokasi kampanye harus dipilih');
      return;
    }

    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      showEditError('Target dana harus diisi dengan angka yang valid');
      return;
    }

    if (!Number.isFinite(nextDaysLeft) || nextDaysLeft < 0) {
      showEditError('Deadline harus diisi dengan angka yang valid');
      return;
    }

    if (!editStory.trim()) {
      showEditError('Cerita kampanye harus diisi');
      return;
    }

    setEditError('');

    onUpdateCampaign?.(campaign.id, {
      title: editTitle.trim(),
      description: campaign.description,
      fullDescription: editStory.trim(),
      location: editLocation.trim(),
      category: editCategory.trim(),
      organizer: editOrganizer.trim(),
      image: editImage.trim() || campaign.image,
      target: nextTarget,
      daysLeft: nextDaysLeft,
      story: editStory.trim(),
      fundAllocation: nextAllocations.length > 0 ? nextAllocations : campaign.fundAllocation,
      disbursementHistory: nextDisbursements.length > 0 ? nextDisbursements : campaign.disbursementHistory
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Kembali ke Kampanye
          </button>
        </div>
      </div>

      {/* Rejection Notification Banner */}
      {campaign.status === 'rejected' && (
        <div className="bg-red-50 border-b-2 border-red-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="text-red-600 flex-shrink-0 mt-0.5">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 mb-1">Kampanye Ditolak</h3>
                <p className="text-red-700 mb-3">
                  Kampanye Anda telah ditolak oleh tim verifikasi. Silakan periksa data kampanye dan coba edit untuk perbaikan, kemudian ajukan ulang untuk verifikasi.
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                >
                  Edit Kampanye untuk Perbaikan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Notification Banner */}
      {campaign.status === 'pending' && canEdit && (
        <div className="bg-amber-50 border-b-2 border-amber-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="text-amber-600 flex-shrink-0 mt-0.5">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-800 mb-1">Menunggu Verifikasi</h3>
                <p className="text-amber-700">
                  Kampanye Anda sedang dalam proses verifikasi oleh tim kami. Anda akan menerima notifikasi setelah verifikasi selesai (biasanya 24-48 jam).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="relative h-96">
                <ImageWithFallback
                  src={campaign.image}
                  alt={campaign.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-full">
                    {campaign.category}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <h1 className="font-bold text-3xl text-gray-900">
                    {campaign.title}
                  </h1>
                  {canEdit && (
                    <button
                      onClick={isEditing ? () => setIsEditing(false) : handleStartEdit}
                      className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-medium"
                    >
                      {isEditing ? 'Batal Edit' : 'Edit Kampanye'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-gray-600 mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    <span>{campaign.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                      <span>{filledDonors} donatur</span>
                {isEditing && canEdit && (
                  <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
                    {editError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {editError}
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Judul Kampanye</label>
                        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                        <select className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white" value={editLocation} onChange={(event) => setEditLocation(event.target.value)}>
                          <option value="" disabled>Pilih lokasi</option>
                          {locationOptions.map((location) => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                        <select className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editCategory} onChange={(event) => setEditCategory(event.target.value)}>
                          <option>UMKM Terdampak Bencana</option>
                          <option>Kesehatan</option>
                          <option>Pendidikan</option>
                          <option>Kemanusiaan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Dana</label>
                        <input type="text" inputMode="numeric" className="w-full rounded-lg border border-gray-300 px-3 py-2" value={formatNumberWithSeparators(editTarget)} onChange={handleTargetChange} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Penggalang Dana (Nama)</label>
                        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editOrganizer} onChange={(event) => setEditOrganizer(event.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (hari lagi)</label>
                        <input type="number" min={0} className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editDaysLeft} onChange={(event) => setEditDaysLeft(event.target.value)} />
                      </div>
                      <div />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cerita & Deskripsi Kampanye</label>
                      <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={8} placeholder="Ceritakan kisah kampanye Anda, mengapa butuh bantuan, dan bagaimana dana akan digunakan. Tulislah dengan detail dan jelas agar donatur memahami kebutuhan Anda." value={editStory} onChange={(event) => setEditStory(event.target.value)} />
                      <p className="mt-2 text-xs text-gray-600">Tuliskan cerita lengkap dalam format paragraf. Ini akan ditampilkan sebagai deskripsi utama kampanye Anda.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gambar Kampanye (URL)</label>
                      <input className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editImage} onChange={(event) => setEditImage(event.target.value)} />
                      <label className="mt-2 inline-block px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 cursor-pointer">
                        Upload gambar baru
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => handleEditImageUpload(event.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transparansi Dana - Alokasi</label>
                      <div className="space-y-2">
                        {editAllocations.map((item, index) => (
                          <div key={`allocation-${index}`} className="grid md:grid-cols-[1.4fr_1fr_1fr_auto] gap-2">
                            <input
                              className="rounded-lg border border-gray-300 px-3 py-2"
                              placeholder="Nama alokasi"
                              value={item.name}
                              onChange={(event) => setEditAllocations((prev) => prev.map((entry, idx) => idx === index ? { ...entry, name: event.target.value } : entry))}
                            />
                            <input
                              type="text"
                              className="rounded-lg border border-gray-300 px-3 py-2"
                              placeholder="Nominal"
                              inputMode="numeric"
                              value={formatNumberWithSeparators(item.value)}
                              onChange={(event) => setEditAllocations((prev) => prev.map((entry, idx) => idx === index ? { ...entry, value: event.target.value.replace(/[^\d]/g, '') } : entry))}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                className="h-10 w-12 rounded-lg border border-gray-300 bg-white px-1 py-1"
                                value={item.color || '#10B981'}
                                onChange={(event) => setEditAllocations((prev) => prev.map((entry, idx) => idx === index ? { ...entry, color: event.target.value } : entry))}
                              />
                              <input
                                className="rounded-lg border border-gray-300 px-3 py-2 w-full"
                                placeholder="#10B981"
                                value={item.color}
                                onChange={(event) => setEditAllocations((prev) => prev.map((entry, idx) => idx === index ? { ...entry, color: event.target.value } : entry))}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditAllocations((prev) => prev.filter((_, idx) => idx !== index))}
                              className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditAllocations((prev) => [...prev, { name: '', value: '', color: '#10B981' }])}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Tambah Alokasi
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transparansi Dana - Pencairan</label>
                      <div className="space-y-2">
                        {editDisbursements.map((item, index) => (
                          <div key={`disbursement-${index}`} className="grid md:grid-cols-[1fr_1fr_1.6fr_auto] gap-2">
                            <input
                              type="date"
                              className="rounded-lg border border-gray-300 px-3 py-2"
                              placeholder="Tanggal"
                              value={item.date}
                              onChange={(event) => setEditDisbursements((prev) => prev.map((entry, idx) => idx === index ? { ...entry, date: event.target.value } : entry))}
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              className="rounded-lg border border-gray-300 px-3 py-2"
                              placeholder="Nominal"
                              value={formatNumberWithSeparators(item.amount)}
                              onChange={(event) => setEditDisbursements((prev) => prev.map((entry, idx) => idx === index ? { ...entry, amount: event.target.value.replace(/[^\d]/g, '') } : entry))}
                            />
                            <input
                              className="rounded-lg border border-gray-300 px-3 py-2"
                              placeholder="Keterangan pencairan"
                              value={item.purpose}
                              onChange={(event) => setEditDisbursements((prev) => prev.map((entry, idx) => idx === index ? { ...entry, purpose: event.target.value } : entry))}
                            />
                            <button
                              type="button"
                              onClick={() => setEditDisbursements((prev) => prev.filter((_, idx) => idx !== index))}
                              className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditDisbursements((prev) => [...prev, { date: '', amount: '', purpose: '' }])}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          Tambah Pencairan
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Simpan Perubahan</button>
                      <button type="button" onClick={() => { syncEditState(); setIsEditing(false); }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Reset</button>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-6">
                  <div className="flex gap-4 mb-6">
                    <button
                      onClick={() => setActiveTab('story')}
                      className={`pb-2 px-1 border-b-2 transition-colors ${
                        activeTab === 'story'
                          ? 'border-blue-600 text-blue-600 font-medium'
                          : 'border-transparent text-gray-600'
                      }`}
                    >
                      <FileText className="w-5 h-5 inline mr-2" />
                      Cerita
                    </button>
                    <button
                      onClick={() => setActiveTab('transparency')}
                      className={`pb-2 px-1 border-b-2 transition-colors ${
                        activeTab === 'transparency'
                          ? 'border-blue-600 text-blue-600 font-medium'
                          : 'border-transparent text-gray-600'
                      }`}
                    >
                      <Shield className="w-5 h-5 inline mr-2" />
                      Transparansi
                    </button>
                    <button
                      onClick={() => setActiveTab('donors')}
                      className={`pb-2 px-1 border-b-2 transition-colors ${
                        activeTab === 'donors'
                          ? 'border-blue-600 text-blue-600 font-medium'
                          : 'border-transparent text-gray-600'
                      }`}
                    >
                      <Heart className="w-5 h-5 inline mr-2" />
                      Donatur ({filledDonors})
                    </button>
                  </div>

                  {activeTab === 'story' && (
                    <div className="prose prose-lg max-w-none">
                      <div className="space-y-4 text-gray-700 leading-relaxed break-words">
                        {(campaign.story || campaign.fullDescription || campaign.description || '')
                          .split('\n\n')
                          .filter(Boolean)
                          .map((paragraph, idx) => (
                          <p key={idx} className="text-base break-words">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'transparency' && (
                    <TransparencyChart
                      fundAllocation={campaign.fundAllocation}
                      disbursementHistory={computedDisbursementHistory}
                    />
                  )}

                  {activeTab === 'donors' && (
                    <div className="space-y-4">
                      {donorEntries.length === 0 ? (
                        campaign.donors === 0 && donorEntries.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
                            Belum ada donasi untuk kampanye ini.
                          </div>
                        ) : loadingDonations ? (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
                            <p className="font-medium text-gray-900">Memuat data donatur...</p>
                            <p className="text-sm text-gray-600 mt-2">Terdapat {filledDonors} donatur</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600 space-y-2">
                            <p className="font-medium text-gray-900">Terdapat {filledDonors} donatur</p>
                            <p className="text-sm text-gray-600">Rincian donasi belum tersedia untuk ditampilkan.</p>
                          </div>
                        )
                      ) : (
                        <>
                          {donorEntries.map((donor, idx) => (
                            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium text-gray-900">{donor.name}</p>
                                  <p className="text-sm text-gray-500">{donor.time}</p>
                                </div>
                                <p className="font-semibold text-blue-600">
                                  Rp {donor.amount.toLocaleString('id-ID')}
                                </p>
                              </div>
                              {donor.message && (
                                <p className="text-sm text-gray-600 italic">"{donor.message}"</p>
                              )}
                            </div>
                          ))}
                          {filledDonors > 5 && (
                            <div className="p-4 text-center text-sm text-gray-600">
                              Menampilkan 5 dari {filledDonors} donatur terbaru
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Terkumpul</span>
                  <span className="font-medium text-blue-600">{percentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div>
                  <p className="font-bold text-2xl text-gray-900">
                    Rp {filledCollected.toLocaleString('id-ID')}
                  </p>
                  <p className="text-gray-600">
                    dari target Rp {filledTarget.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <div className={`mb-6 p-4 rounded-lg ${isVerified ? 'bg-blue-50' : campaign.status === 'pending' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                <div className="flex items-start gap-3">
                  <Shield className={`w-5 h-5 mt-0.5 ${isVerified ? 'text-blue-600' : campaign.status === 'pending' ? 'text-amber-600' : 'text-rose-600'}`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 mb-1">Kampanye {statusLabel}</p>
                    <p className="text-sm text-gray-600">{statusDescription}</p>
                    {isRecurringActive && (
                      <div className="mt-3">
                        <button
                          onClick={() => {
                            if (!user?.email) {
                              alert('Anda harus masuk untuk mengelola donasi rutin.');
                              return;
                            }
                            const ok = confirm('Hentikan donasi rutin untuk kampanye ini?');
                            if (!ok) return;
                            try {
                              const raw = localStorage.getItem('bantusesama-recurring-donors') || '[]';
                              const records: Array<any> = JSON.parse(raw || '[]');
                              const filtered = records.filter((r) => !(r.email === user.email && Number(r.campaignId) === Number(campaign.id)));
                              localStorage.setItem('bantusesama-recurring-donors', JSON.stringify(filtered));
                              setIsRecurringActive(false);
                              alert('Donasi rutin berhasil dihentikan.');
                            } catch (err) {
                              alert('Gagal menghentikan donasi rutin. Coba lagi.');
                            }
                          }}
                          className="mt-2 px-3 py-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Hentikan Donasi Rutin
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {canEdit && onRequestWithdrawal && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">Request Withdrawal</p>
                      <p className="text-sm text-gray-600">Cairkan dana lewat pengajuan ke admin terlebih dahulu.</p>
                    </div>
                    <p className="text-xs text-gray-500 whitespace-nowrap">Terkumpul Rp {filledCollected.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nominal pencairan</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberWithSeparators(withdrawAmount)}
                        onChange={(event) => setWithdrawAmount(event.target.value.replace(/[^\d]/g, ''))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Rp 0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
                      <textarea
                        value={withdrawNote}
                        onChange={(event) => setWithdrawNote(event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        rows={3}
                        placeholder="Contoh: pencairan tahap 1 untuk renovasi"
                      />
                    </div>
                    {withdrawError && <p className="text-sm text-red-600">{withdrawError}</p>}
                    <button
                      type="button"
                      onClick={handleWithdrawalRequest}
                      className="w-full rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
                    >
                      Request Withdrawal
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-3"
              >
                Donasi Sekarang
              </button>

              <button onClick={() => setShowShareMenu(!showShareMenu)} className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 relative">
                <Share2 className="w-5 h-5" />
                Bagikan Kampanye
              </button>

              {/* Share Menu */}
              <div className="relative mt-2">
                {showShareMenu && (
                  <div ref={shareMenuRef} className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3 grid grid-cols-3 gap-2">
                    {getShareOptions(campaign).map((option) => (
                      <button
                        key={option.name}
                        onClick={() => {
                          if (option.isCopy) {
                            navigator.clipboard.writeText(option.url);
                            alert('Link disalin!');
                          } else {
                            window.open(option.url, '_blank', 'width=600,height=400');
                          }
                          setShowShareMenu(false);
                        }}
                        className={`p-2 text-center text-sm font-medium rounded hover:bg-gray-50 ${option.bg || ''}`}
                        title={option.name}
                      >
                        <div className="text-lg flex items-center justify-center">
                          <div className={`p-2 rounded-full ${option.iconBg || 'bg-transparent'}`}>
                            {option.icon}
                          </div>
                        </div>
                        <div className="text-xs mt-1">{option.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Penggalang Dana:</p>
                <p className="font-medium text-gray-900">{campaign.organizer}</p>
              </div>
              {isRecurringActive && (
                <div className="mt-4">
                  <button
                    onClick={() => {
                      if (!user?.email) {
                        alert('Anda harus masuk untuk mengelola donasi rutin.');
                        return;
                      }
                      const ok = confirm('Hentikan donasi rutin untuk kampanye ini?');
                      if (!ok) return;
                      try {
                        const raw = localStorage.getItem('bantusesama-recurring-donors') || '[]';
                        const records: Array<any> = JSON.parse(raw || '[]');
                        const filtered = records.filter((r) => !(r.email === user.email && Number(r.campaignId) === Number(campaign.id)));
                        localStorage.setItem('bantusesama-recurring-donors', JSON.stringify(filtered));
                        setIsRecurringActive(false);
                        alert('Donasi rutin berhasil dihentikan.');
                      } catch (err) {
                        alert('Gagal menghentikan donasi rutin. Coba lagi.');
                      }
                    }}
                    className="w-full mt-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Hentikan Donasi Rutin
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        user={user}
        onDonationSuccess={onDonationSuccess}
        onNavigateToContinuePayment={onNavigateToContinuePayment}
      />
    </div>
  );
}

// add share functionality below component export
export function shareCampaign(campaign: { id: number; title: string }) {
  const url = `${window.location.origin}/?campaign=${campaign.id}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(campaign.title);
  const text = encodeURIComponent(`Bantu kampanye "${campaign.title}" di BantuSesama. Setiap rupiah sangat membantu! 🙏`);

  // Try native share first
  if ((navigator as any).share) {
    try {
      (navigator as any).share({ title: campaign.title, text: `Bantu kampanye "${campaign.title}"`, url });
      return;
    } catch (e) {
      // ignore
    }
  }

  // Fallback: show share options
  const shareOptions = {
    whatsapp: `https://wa.me/?text=${text}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${text}`,
    email: `mailto:?subject=${encodedTitle}&body=Bantulah kampanye ${encodedTitle} di BantuSesama: ${url}`
  };

  // Copy to clipboard as default
  navigator.clipboard.writeText(url).then(() => {
    alert('Link kampanye telah disalin. Bagikan ke teman-teman Anda!\n\nAtau gunakan:\n✓ WhatsApp\n✓ Facebook\n✓ Twitter\n✓ Telegram\n✓ Email');
  });
}

export function getShareOptions(campaign: { id: number; title: string }) {
  const url = `${window.location.origin}/?campaign=${campaign.id}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(campaign.title);
  const text = encodeURIComponent(`Bantu kampanye "${campaign.title}" di BantuSesama. Setiap rupiah sangat membantu! 🙏`);

  return [
    {
      name: 'WhatsApp',
      icon: <Send className="w-5 h-5 text-green-600" />,
      url: `https://wa.me/?text=${text}%20${encodedUrl}`,
      bg: 'hover:bg-green-50',
      iconBg: 'bg-green-100'
    },
    {
      name: 'Facebook',
      icon: <Facebook className="w-5 h-5 text-blue-600" />,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
      bg: 'hover:bg-blue-50',
      iconBg: 'bg-blue-100'
    },
    {
      name: 'Twitter',
      icon: <Twitter className="w-5 h-5 text-sky-500" />,
      url: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
      bg: 'hover:bg-sky-50',
      iconBg: 'bg-sky-100'
    },
    {
      name: 'Telegram',
      icon: <MessageCircle className="w-5 h-5 text-blue-500" />,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${text}`,
      bg: 'hover:bg-blue-50',
      iconBg: 'bg-blue-100'
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5 text-rose-500" />,
      url: `mailto:?subject=${encodedTitle}&body=Bantulah kampanye "${campaign.title}" di BantuSesama: ${url}`,
      bg: 'hover:bg-rose-50',
      iconBg: 'bg-rose-100'
    },
    {
      name: 'Salin Link',
      icon: <Link2 className="w-5 h-5 text-gray-700" />,
      url: url,
      isCopy: true,
      bg: 'hover:bg-gray-50',
      iconBg: 'bg-gray-100'
    }
  ];
}
