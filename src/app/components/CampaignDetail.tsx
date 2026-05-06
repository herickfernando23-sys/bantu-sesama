import { ImageWithFallback } from './ImageWithFallback';
import { MapPin, Users, Calendar, Share2, Heart, TrendingUp, Shield, FileText } from 'lucide-react';
import { TransparencyChart } from './TransparencyChart';
import { useEffect, useState } from 'react';
import { PaymentModal } from './PaymentModal';

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
  onDonationSuccess?: (amount: number, donorInfo: {name: string; message: string}) => void;
}

type AllocationEditorItem = { name: string; value: string; color: string };
type DisbursementEditorItem = { date: string; amount: string; purpose: string };

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

export function CampaignDetail({ campaign, user, onBack, onUpdateCampaign, onRequestWithdrawal, onDonationSuccess, withdrawalRequests }: CampaignDetailProps) {
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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(campaign.title);
  const [editDescription, setEditDescription] = useState(campaign.description);
  const [editLocation, setEditLocation] = useState(campaign.location);
  const [editTarget, setEditTarget] = useState(String(campaign.target));
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

  const percentage = Math.min((campaign.collected / campaign.target) * 100, 100);
  const canEdit = user?.email && campaign.creatorEmail && user.email.toLowerCase() === campaign.creatorEmail.toLowerCase();
  
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
  
  const donorEntries = campaign.donations && campaign.donations.length > 0
    ? campaign.donations.map(donation => ({
        name: donation.name,
        amount: donation.amount,
        message: donation.message,
        time: getTimeAgo(donation.timestamp)
      })).reverse().slice(0, 5)
    : [];

  const syncEditState = () => {
    setEditTitle(campaign.title);
    setEditDescription(campaign.description);
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

    if (!editTitle.trim() || !editDescription.trim() || !editLocation.trim() || !Number.isFinite(nextTarget) || nextTarget <= 0 || !Number.isFinite(nextDaysLeft) || nextDaysLeft < 0) {
      return;
    }

    onUpdateCampaign?.(campaign.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
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
                    <span>{campaign.donors} donatur</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    <span>{campaign.daysLeft} hari lagi</span>
                  </div>
                </div>

                {isEditing && canEdit && (
                  <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Judul Kampanye</label>
                        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} />
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
                      <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cerita Lengkap</label>
                      <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2" rows={5} value={editStory} onChange={(event) => setEditStory(event.target.value)} />
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
                      <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Simpan Perubahan</button>
                      <button onClick={() => { syncEditState(); setIsEditing(false); }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Reset</button>
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
                      Donatur ({campaign.donors})
                    </button>
                  </div>

                  {activeTab === 'story' && (
                    <div className="prose max-w-none">
                      <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                        {campaign.story}
                      </p>
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
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
                          Belum ada donasi untuk kampanye ini.
                        </div>
                      ) : (
                        donorEntries.map((donor, idx) => (
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
                        ))
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
                    Rp {campaign.collected.toLocaleString('id-ID')}
                  </p>
                  <p className="text-gray-600">
                    dari target Rp {campaign.target.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Kampanye Terverifikasi</p>
                    <p className="text-sm text-gray-600">
                      Penggalang dana telah diverifikasi oleh tim BantuSesama
                    </p>
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
                    <p className="text-xs text-gray-500 whitespace-nowrap">Terkumpul Rp {campaign.collected.toLocaleString('id-ID')}</p>
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

              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?campaign=${campaign.id}`); alert('Link kampanye disalin ke clipboard'); }} className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                <Share2 className="w-5 h-5" />
                Bagikan Kampanye
              </button>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Penggalang Dana:</p>
                <p className="font-medium text-gray-900">{campaign.organizer}</p>
              </div>
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
      />
    </div>
  );
}

// add share functionality below component export
export function shareCampaign(campaign: { id: number; title: string }) {
  const url = `${window.location.origin}/?campaign=${campaign.id}`;
  if ((navigator as any).share) {
    try { (navigator as any).share({ title: campaign.title, url }); return; } catch (e) { /* ignore */ }
  }
  navigator.clipboard.writeText(url);
  alert('Link kampanye disalin ke clipboard');
}
