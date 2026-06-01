import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useEffect, useRef, useState } from 'react';
import { apiUrl, getApiBaseUrl } from '../lib/apiBaseUrl';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Flag,
  HeartHandshake,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

type CampaignStatus = 'verified' | 'pending' | 'rejected';
type WithdrawalStatus = 'Pending' | 'Success' | 'Rejected';

type Campaign = {
  id: number;
  createdAt?: number;
  title: string;
  description: string;
  location: string;
  target: number;
  collected: number;
  donors: number;
  daysLeft: number;
  category: string;
  organizer: string;
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

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'pending';
  campaignCount: number;
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const cleanDisplayText = (value: unknown) => String(value ?? '').replace(/^\s*#{1,6}\s*/gm, '').replace(/\s+/g, ' ').trim();

interface AdminDashboardProps {
  campaigns: Campaign[];
  users: AdminUser[];
  withdrawalRequests: WithdrawalRequest[];
  user?: { name: string; email?: string } | null;
  onVerifyCampaign: (campaignId: number) => void;
  onRejectCampaign: (campaignId: number) => void;
  onDeleteUser: (email: string) => void;
  onUpdateWithdrawalStatus: (requestId: number, status: WithdrawalStatus) => void;
  onClearWithdrawals?: () => void;
  onLogout?: () => void;
}

function TipsPanel() {
  const [tips, setTips] = useState<Array<any>>([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [errorTips, setErrorTips] = useState('');
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const loadTips = async () => {
    setLoadingTips(true);
    setErrorTips('');
    try {
      const resp = await fetch(apiUrl('/api/tips'));
      if (!resp.ok) throw new Error('Gagal memuat tips');
      const list = await resp.json();
      setTips(list);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error('Load tips error', err);
      setErrorTips(err instanceof Error ? err.message : 'Gagal memuat tips');
    } finally {
      setLoadingTips(false);
    }
  };

  const deleteTip = async (tipId: number) => {
    if (!window.confirm('Hapus tip ini dari daftar?')) return;
    try {
      const resp = await fetch(apiUrl(`/api/tips/${tipId}`), { method: 'DELETE' });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menghapus tip');
      }
      setTips((current) => current.filter((tip) => tip.id !== tipId));
    } catch (err) {
      alert('Gagal menghapus tip: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  useEffect(() => {
    loadTips();
    const timer = window.setInterval(() => {
      loadTips();
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={loadTips}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
        >
          Muat Ulang
        </button>
        <div className="text-xs text-slate-400">
          {lastRefresh ? `Terakhir diperbarui ${new Date(lastRefresh).toLocaleTimeString()}` : 'Belum diperbarui'}
        </div>
      </div>
      {errorTips && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {errorTips}
        </div>
      )}
      {loadingTips ? (
        <div className="text-slate-400">Memuat tips...</div>
      ) : tips.length === 0 ? (
        <div className="text-slate-400">Belum ada tip masuk.</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-auto">
          {tips.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-700 p-3 bg-slate-700/30">
              <div>
                <div className="font-medium text-slate-100">Rp {Number(t.amount).toLocaleString('id-ID')} — {t.donorName || 'Anonim'}</div>
                <div className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-300">{t.paymentStatus}</div>
                <button onClick={() => deleteTip(t.id)} className="rounded px-2 py-1 bg-red-600 text-white text-xs">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminDashboard({ campaigns, users, withdrawalRequests, user, onVerifyCampaign, onRejectCampaign, onDeleteUser, onUpdateWithdrawalStatus, onClearWithdrawals, onLogout }: AdminDashboardProps) {
  const PAGE_SIZE = 6;
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignFadeOut, setCampaignFadeOut] = useState(false);
  const pageTransitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
    setCampaignPage((currentPage) => Math.min(currentPage, totalPages));
  }, [campaigns]);

  useEffect(() => () => {
    if (pageTransitionTimerRef.current) {
      window.clearTimeout(pageTransitionTimerRef.current);
      pageTransitionTimerRef.current = null;
    }
  }, []);

  const normalizedCampaigns = campaigns.map((campaign) => {
    const normalizedTarget = Math.max(0, toSafeNumber(campaign.target, 0));
    const normalizedCollected = Math.max(0, toSafeNumber(campaign.collected, 0));
    const normalizedDonors = Math.max(0, toSafeNumber(campaign.donors, 0));
    const normalizedStatus = campaign.id <= 6
      ? (campaign.status === 'rejected' ? 'rejected' : 'verified')
      : (campaign.status ?? 'pending');

    return {
      ...campaign,
      title: cleanDisplayText(campaign.title),
      description: cleanDisplayText(campaign.description),
      location: cleanDisplayText(campaign.location),
      organizer: cleanDisplayText(campaign.organizer),
      category: cleanDisplayText(campaign.category),
      target: normalizedTarget,
      collected: normalizedCollected,
      donors: normalizedDonors,
      status: normalizedStatus,
    };
  });

  const sortedCampaigns = [...normalizedCampaigns].sort((a, b) => (b.createdAt ?? b.id) - (a.createdAt ?? a.id));
  const totalCampaignPages = Math.max(1, Math.ceil(sortedCampaigns.length / PAGE_SIZE));
  const paginatedCampaigns = sortedCampaigns.slice((campaignPage - 1) * PAGE_SIZE, campaignPage * PAGE_SIZE);

  const goToCampaignPage = (nextPage: number) => {
    if (nextPage === campaignPage) {
      return;
    }

    if (pageTransitionTimerRef.current) {
      window.clearTimeout(pageTransitionTimerRef.current);
    }

    setCampaignFadeOut(true);
    pageTransitionTimerRef.current = window.setTimeout(() => {
      setCampaignPage(nextPage);
      window.requestAnimationFrame(() => setCampaignFadeOut(false));
      pageTransitionTimerRef.current = null;
    }, 220);
  };

  const totalRaised = normalizedCampaigns.reduce((sum, campaign) => sum + campaign.collected, 0);
  const totalTarget = normalizedCampaigns.reduce((sum, campaign) => sum + campaign.target, 0);
  const totalDonors = normalizedCampaigns.reduce((sum, campaign) => sum + campaign.donors, 0);
  const avgProgress = totalTarget > 0 ? (totalRaised / totalTarget) * 100 : 0;

  const pendingCampaigns = normalizedCampaigns.filter((campaign) => campaign.status === 'pending');
  const rejectedCampaigns = normalizedCampaigns.filter((campaign) => campaign.status === 'rejected');
  const verifiedCampaigns = normalizedCampaigns.filter((campaign) => campaign.status !== 'pending' && campaign.status !== 'rejected');

  const stats = [
    {
      label: 'Total Kampanye',
      value: normalizedCampaigns.length.toString(),
      icon: HeartHandshake,
      tone: 'bg-blue-900/20 text-blue-200',
    },
    {
      label: 'Dana Terkumpul',
      value: `Rp ${totalRaised.toLocaleString('id-ID')}`,
      icon: Wallet,
      tone: 'bg-emerald-900/20 text-emerald-200',
    },
    {
      label: 'Total Donatur',
      value: totalDonors.toLocaleString('id-ID'),
      icon: Users,
      tone: 'bg-amber-900/20 text-amber-200',
    },
    {
      label: 'Rata-rata Progress',
      value: `${avgProgress.toFixed(0)}%`,
      icon: BarChart3,
      tone: 'bg-violet-900/20 text-violet-200',
    },
  ];

  // Sponsorship banners (frontend-only management stored in localStorage)
  const bannersKey = 'bantusesama-sponsor-banners';
  type SponsorBanner = { id: number; title: string; link?: string; imageBase64: string; createdAt: number };
  const apiBaseUrl = getApiBaseUrl();
  const resolveBannerImageSrc = (imageUrl: string) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) return imageUrl;
    return `${apiBaseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  };
  const [banners, setBanners] = useState<SponsorBanner[]>(() => {
    try {
      const raw = window.localStorage.getItem(bannersKey);
      return raw ? (JSON.parse(raw) as SponsorBanner[]) : [];
    } catch {
      return [] as SponsorBanner[];
    }
  });

  const saveBanners = (next: SponsorBanner[]) => {
    setBanners(next);
    window.localStorage.setItem(bannersKey, JSON.stringify(next));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const requestList = () => fetch(apiUrl('/api/sponsor-banners'));
        let resp = await requestList().catch(() => null);
        if (!resp || !resp.ok) return;

        const list = await resp.json();
        if (!Array.isArray(list) || cancelled) return;

        const mapped: SponsorBanner[] = list.map((b: any) => ({
          id: Number(b.id),
          title: b.title,
          link: b.link,
          imageBase64: resolveBannerImageSrc(b.imageUrl),
          createdAt: new Date(b.createdAt).getTime(),
        }));
        saveBanners(mapped);
      } catch {
        // ignore load errors and keep local snapshot
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const handleAddBanner = async (file: File, title: string, link?: string) => {
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('title', title || 'Sponsor');
      if (link) form.append('link', link);

      const requestBannerUpload = () => fetch(apiUrl('/api/sponsor-banners'), { method: 'POST', body: form });

      let resp = await requestBannerUpload().catch(() => null);

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'Upload gagal');
      }

      const result = await resp.json();
      const created = result.banner;
      const next: SponsorBanner = {
        id: created.id,
        title: created.title,
        link: created.link,
        imageBase64: resolveBannerImageSrc(created.imageUrl),
        createdAt: new Date(created.createdAt).getTime()
      };
      saveBanners([next, ...banners]);
    } catch (err) {
      alert('Gagal mengunggah banner: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteBanner = async (id: number) => {
    const next = banners.filter((b) => b.id !== id);

    // Update UI immediately so a stale banner entry cannot block the action.
    saveBanners(next);

    try {
      const numericId = Number(id);
      if (!Number.isSafeInteger(numericId) || numericId <= 0) return;

      let resp = await fetch(apiUrl(`/api/sponsor-banners/${numericId}`), { method: 'DELETE' }).catch(() => null);

      if (resp && !resp.ok && resp.status !== 404) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menghapus banner');
      }
    } catch (err) {
      console.error('Delete banner failed', err);
    }
  };

  const BannerManager = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>('');

    useEffect(() => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result || ''));
      reader.readAsDataURL(file);
    }, [file]);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm text-slate-300 mb-1">Judul Banner</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-100" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Link (opsional)</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-slate-100" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
          >
            Pilih Gambar
          </button>
          <span className="text-sm text-slate-400">
            {file ? file.name : 'Belum ada file dipilih'}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!file) return alert('Pilih file gambar terlebih dahulu');
              if (!title) return alert('Masukkan judul banner');
              handleAddBanner(file, title, link || undefined);
              setTitle(''); setLink(''); setFile(null); setPreview('');
            }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-white"
          >Unggah Banner</button>
          {preview && <img src={preview} alt="preview" className="h-12 rounded object-cover border" />}
        </div>

        <div>
          {banners.length === 0 ? (
            <div className="text-slate-400">Belum ada banner sponsor.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {banners.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border border-slate-700 p-3 bg-slate-800">
                  <img src={resolveBannerImageSrc(b.imageBase64)} alt={b.title} className="w-28 h-16 object-cover rounded bg-slate-900" />
                  <div className="flex-1">
                    <div className="text-slate-100 font-semibold">{b.title}</div>
                    <div className="text-slate-400 text-xs">{b.link || <span className="italic text-slate-500">Tanpa link</span>}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => window.open(b.link || '#', '_blank')} className="rounded px-2 py-1 bg-slate-700 text-slate-100 text-xs">Buka</button>
                    <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); handleDeleteBanner(b.id); }} className="rounded px-2 py-1 bg-red-600 text-white text-xs relative z-20 pointer-events-auto">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const statusBadge = (status: CampaignStatus) => {
    if (status === 'verified') {
      return <Badge className="bg-emerald-900/30 text-emerald-200 border-emerald-700">Terverifikasi</Badge>;
    }

    if (status === 'rejected') {
      return <Badge className="bg-red-900/30 text-red-200 border-red-700">Ditolak</Badge>;
    }

    return <Badge className="bg-amber-900/30 text-amber-200 border-amber-700">Menunggu</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 bg-slate-800/90 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  BantuSesama Admin Center
                </div>
                <h1 className="text-3xl font-bold text-slate-100">Website Admin</h1>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <Badge variant="secondary" className="bg-blue-900/30 text-blue-200 border-blue-700">Live</Badge>
                <span className="text-sm text-slate-400">{user ? `Masuk sebagai ${user.name}` : 'Mode demo admin'}</span>
                {user && onLogout && (
                  <button
                    onClick={onLogout}
                    className="px-3 py-1 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-slate-800 border-slate-700 shadow-sm">
                <CardContent className="p-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-2">{stat.label}</p>
                    <div className="text-2xl font-bold text-slate-100">{stat.value}</div>
                  </div>
                  <div className={`rounded-2xl p-3 ${stat.tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section>
          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100">Kelola Iklan Sponsor (Sponsorship Banner)</CardTitle>
              <CardDescription className="text-slate-400">
                Unggah banner sponsor untuk ditampilkan di halaman publik. Ini menyimpan data secara lokal; integrasikan ke backend nanti.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <BannerManager />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100">Daftar Tips Masuk</CardTitle>
              <CardDescription className="text-slate-400">Lihat tips sukarela yang masuk ke platform (demo).</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <TipsPanel />
            </CardContent>
          </Card>
        </section>

        <section className="grid xl:grid-cols-[1.3fr_1fr] gap-6">
          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-blue-400" />
                Kampanye Menunggu Verifikasi
              </CardTitle>
              <CardDescription className="text-slate-400">
                Admin bisa verifikasi atau menolak kampanye baru sebelum tampil di halaman publik.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              {pendingCampaigns.length === 0 ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-700/50 p-6 text-slate-400">
                  Tidak ada kampanye yang menunggu verifikasi.
                </div>
              ) : (
                pendingCampaigns.map((campaign) => {
                  const progress = campaign.target > 0 ? Math.min((campaign.collected / campaign.target) * 100, 100) : 0;
                  return (
                    <div key={campaign.id} className="rounded-2xl border border-slate-700 bg-slate-700/30 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="border-slate-600 text-slate-200">{campaign.category}</Badge>
                            {statusBadge(campaign.status ?? 'verified')}
                          </div>
                          <h3 className="font-semibold text-lg text-slate-100">{campaign.title}</h3>
                          <p className="text-sm text-slate-400">{campaign.location} • {campaign.organizer}</p>
                          <p className="text-sm text-slate-300 line-clamp-2">{campaign.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onVerifyCampaign(campaign.id)}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                          >
                            Verifikasi
                          </button>
                          <button
                            onClick={() => onRejectCampaign(campaign.id)}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Tolak
                          </button>
                        </div>
                      </div>

                      <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                        <span>Progress penggalangan</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Flag className="w-5 h-5 text-blue-400" />
                Status Operasional
              </CardTitle>
              <CardDescription className="text-slate-400">
                Ringkasan cepat keadaan platform dan status moderasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-700/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Kampanye terverifikasi</span>
                  <span className="text-slate-100 font-medium">{verifiedCampaigns.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Kampanye pending</span>
                  <span className="text-slate-100 font-medium">{pendingCampaigns.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Kampanye ditolak</span>
                  <span className="text-slate-100 font-medium">{rejectedCampaigns.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Status platform</span>
                  <Badge variant="secondary" className="bg-emerald-900/30 text-emerald-200 border-emerald-700">
                    Stabil
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-700/30 p-4">
                  <div>
                    <p className="font-medium text-slate-100">Review user baru</p>
                    <p className="text-sm text-slate-400">{users.filter((item) => item.status === 'pending').length} user menunggu</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-700/30 p-4">
                  <div>
                    <p className="font-medium text-slate-100">Pemeriksaan laporan</p>
                    <p className="text-sm text-slate-400">2 pencairan perlu ditinjau</p>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid xl:grid-cols-2 gap-6">
          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100">Tabel Kelola User</CardTitle>
              <CardDescription className="text-slate-400">
                Daftar pengguna dan perannya di platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="w-full">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="pb-3 font-medium">Nama</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Kampanye</th>
                      <th className="pb-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id} className="border-b border-slate-700 last:border-b-0">
                        <td className="py-4 pr-4 text-slate-100 font-medium">{item.name}</td>
                        <td className="py-4 pr-4 text-slate-300">{item.email}</td>
                        <td className="py-4 pr-4">
                          <Badge variant={item.role === 'admin' ? 'secondary' : 'outline'} className={item.role === 'admin' ? 'bg-blue-900/30 text-blue-200 border-blue-700' : 'border-slate-600 text-slate-200'}>
                            {item.role}
                          </Badge>
                        </td>
                        <td className="py-4 pr-4">
                          <Badge variant="outline" className={item.status === 'active' ? 'border-emerald-700 text-emerald-200 bg-emerald-900/30' : 'border-amber-700 text-amber-200 bg-amber-900/30'}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-4 pr-4 text-slate-300">{item.campaignCount}</td>
                        <td className="py-4 pr-4">
                          {item.role === 'user' ? (
                            <button
                              onClick={() => onDeleteUser(item.email)}
                              className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Hapus
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100">Tabel Kelola Kampanye</CardTitle>
              <CardDescription className="text-slate-400">
                Seluruh kampanye dengan status verifikasi masing-masing.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className={`w-full max-h-[420px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-700 transition-opacity duration-300 ${campaignFadeOut ? 'opacity-0' : 'opacity-100'}`}>
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-800 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-4 pr-3 font-medium w-[34%]">Kampanye</th>
                      <th className="py-4 pr-3 font-medium w-[18%]">Lokasi</th>
                      <th className="py-4 pr-3 font-medium w-[16%]">Status</th>
                      <th className="py-4 pr-3 font-medium w-[16%]">Progress</th>
                      <th className="py-4 font-medium w-[16%]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCampaigns.map((campaign) => {
                      const progress = campaign.target > 0 ? Math.min((campaign.collected / campaign.target) * 100, 100) : 0;
                      const isPending = campaign.status === 'pending';
                      const isRejected = campaign.status === 'rejected';

                      return (
                        <tr key={campaign.id} className="border-b border-slate-700/80 last:border-b-0 align-top">
                          <td className="py-5 pr-3 break-words whitespace-normal">
                            <div className="font-medium text-slate-100 leading-6">{campaign.title}</div>
                            <div className="text-xs text-slate-400 mt-2 leading-5">{campaign.organizer}</div>
                          </td>
                          <td className="py-5 pr-3 text-slate-300 break-words whitespace-normal leading-6">{campaign.location}</td>
                          <td className="py-5 pr-3">{statusBadge(campaign.status ?? 'verified')}</td>
                          <td className="py-5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 rounded-full bg-slate-700 overflow-hidden">
                                <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 whitespace-nowrap">{progress.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-5">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => onVerifyCampaign(campaign.id)}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                Verifikasi
                              </button>
                              <button
                                onClick={() => onRejectCampaign(campaign.id)}
                                className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                Tolak
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalCampaignPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={() => goToCampaignPage(Math.max(1, campaignPage - 1))}
                    disabled={campaignPage === 1}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${campaignPage === 1 ? 'cursor-not-allowed border-slate-700 text-slate-500' : 'border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalCampaignPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      onClick={() => goToCampaignPage(pageNumber)}
                      aria-current={campaignPage === pageNumber ? 'page' : undefined}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${campaignPage === pageNumber ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    onClick={() => goToCampaignPage(Math.min(totalCampaignPages, campaignPage + 1))}
                    disabled={campaignPage === totalCampaignPages}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${campaignPage === totalCampaignPages ? 'cursor-not-allowed border-slate-700 text-slate-500' : 'border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
                  >
                    Next
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100">Request Withdrawal</CardTitle>
              <CardDescription className="text-slate-400">
                Penggalang dana mengajukan pencairan dana terlebih dahulu, lalu admin dapat mengubah statusnya.
              </CardDescription>
              <div className="px-6 pb-3 flex items-center justify-end">
                <button
                  onClick={() => onClearWithdrawals && onClearWithdrawals()}
                  className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600"
                >
                  Clear All Processed
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {withdrawalRequests.length === 0 ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-700/30 p-6 text-slate-400">
                  Belum ada request withdrawal.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="pb-3 font-medium">Kampanye</th>
                        <th className="pb-3 font-medium">Pengaju</th>
                        <th className="pb-3 font-medium">Nominal</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawalRequests.map((request) => (
                        <tr key={request.id} className="border-b border-slate-700 last:border-b-0">
                          <td className="py-4 pr-4">
                            <div className="font-medium text-slate-100">{request.campaignTitle}</div>
                            <div className="text-xs text-slate-400">#{request.campaignId}</div>
                          </td>
                          <td className="py-4 pr-4 text-slate-300">
                            <div>{request.requestedByName}</div>
                            <div className="text-xs text-slate-500">{request.requestedByEmail}</div>
                          </td>
                          <td className="py-4 pr-4 text-slate-300">Rp {request.amount.toLocaleString('id-ID')}</td>
                          <td className="py-4 pr-4">
                            <Badge
                              variant="outline"
                              className={request.status === 'Pending'
                                ? 'border-amber-700 text-amber-200 bg-amber-900/30'
                                : request.status === 'Success'
                                  ? 'border-emerald-700 text-emerald-200 bg-emerald-900/30'
                                  : 'border-red-700 text-red-200 bg-red-900/30'}
                            >
                              {request.status}
                            </Badge>
                            {request.note && <p className="mt-1 text-xs text-slate-500">{request.note}</p>}
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex flex-wrap gap-2">
                              {request.status === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => onUpdateWithdrawalStatus(request.id, 'Success')}
                                    className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => onUpdateWithdrawalStatus(request.id, 'Rejected')}
                                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                                  >
                                    Not Approved
                                  </button>
                                </>
                              )}
                              {request.status !== 'Pending' && (
                                <select
                                  value={request.status}
                                  onChange={(e) => onUpdateWithdrawalStatus(request.id, e.target.value as WithdrawalStatus)}
                                  className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-200 border border-slate-600 hover:bg-slate-600"
                                >
                                  <option value="Success">Success</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="bg-slate-800 border-slate-700 shadow-sm">
            <CardHeader className="px-6 pt-6">
              <CardTitle className="text-slate-100">Riwayat Pencairan</CardTitle>
              <CardDescription className="text-slate-400">
                Daftar pencairan dana yang telah disetujui dan berhasil diproses.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {withdrawalRequests.filter((r) => r.status === 'Success').length === 0 ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-700/30 p-6 text-slate-400">
                  Belum ada pencairan yang berhasil.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="pb-3 font-medium">Kampanye</th>
                        <th className="pb-3 font-medium">Pengaju</th>
                        <th className="pb-3 font-medium">Nominal</th>
                        <th className="pb-3 font-medium">Catatan</th>
                        <th className="pb-3 font-medium">Tanggal Disetujui</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawalRequests
                        .filter((r) => r.status === 'Success')
                        .reverse()
                        .map((request) => (
                          <tr key={request.id} className="border-b border-slate-700 last:border-b-0">
                            <td className="py-4 pr-4">
                              <div className="font-medium text-slate-100">{request.campaignTitle}</div>
                              <div className="text-xs text-slate-400">#{request.campaignId}</div>
                            </td>
                            <td className="py-4 pr-4 text-slate-300">
                              <div>{request.requestedByName}</div>
                              <div className="text-xs text-slate-500">{request.requestedByEmail}</div>
                            </td>
                            <td className="py-4 pr-4 text-emerald-300 font-semibold">Rp {request.amount.toLocaleString('id-ID')}</td>
                            <td className="py-4 pr-4 text-slate-300 text-xs">
                              {request.note || <span className="text-slate-500 italic">Tidak ada catatan</span>}
                            </td>
                            <td className="py-4 pr-4 text-slate-400 text-xs">
                              {new Date(request.updatedAt).toLocaleDateString('id-ID', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}