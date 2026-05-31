import { Logo } from './Logo';
import { Menu, X, Heart, User, Bell, Clock3, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TipWidget } from './TipWidget';
import { apiUrl, getApiBaseUrl } from '../lib/apiBaseUrl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';


interface NavbarProps {
  onNavigate?: (page: string) => void;
  onHome?: () => void;
  user?: { name: string } | null;
  onLogout?: () => void;
  pendingPayments?: Array<{
    donationId: number;
    orderId: string;
    campaignTitle: string;
    amount: number;
    method: 'virtual_account' | 'ewallet';
    redirectUrl?: string;
    createdAt: number;
  }>;
  onOpenPendingPayment?: (payment: {
    donationId: number;
    orderId: string;
    campaignTitle: string;
    amount: number;
    method: 'virtual_account' | 'ewallet';
    redirectUrl?: string;
    createdAt: number;
  }) => void;
}

export function Navbar({ onNavigate, onHome, user, onLogout, pendingPayments = [], onOpenPendingPayment }: NavbarProps) {

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [banner, setBanner] = useState<{ imageUrl: string; link?: string; title?: string } | null>(null);
  const apiBaseUrl = getApiBaseUrl();
  const resolveBannerImageSrc = (imageUrl: string) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      return imageUrl;
    }
    return `${apiBaseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(apiUrl('/api/sponsor-banners'));
        if (!resp.ok) return;
        const list = await resp.json();
        if (Array.isArray(list) && list.length > 0) {
          setBanner({ imageUrl: resolveBannerImageSrc(list[0].imageUrl), link: list[0].link, title: list[0].title });
        }
      } catch (err) {
        // ignore
      }
    })();
  }, []);

  return (
    <>
      {banner && (
        <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center justify-center py-2">
          {banner.link ? (
            <div className="w-full flex justify-center">
              <a href={banner.link} target="_blank" rel="noreferrer" className="block">
                <img src={banner.imageUrl} alt={banner.title || 'Sponsor'} className="w-[728px] max-w-full h-[90px] object-cover" />
              </a>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div>
                <img src={banner.imageUrl} alt={banner.title || 'Sponsor'} className="w-[728px] max-w-full h-[90px] object-cover" />
              </div>
            </div>
          )}
        </div>
      )}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Logo onClick={onHome} />

          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => (onNavigate && onNavigate('kampanye'))} className="text-gray-700 hover:text-blue-600">Kampanye</button>
            <button onClick={() => (onNavigate && onNavigate('cara-kerja'))} className="text-gray-700 hover:text-blue-600">Cara Kerja</button>
            <button onClick={() => (onNavigate && onNavigate('donasi-saya'))} className="text-gray-700 hover:text-blue-600 flex items-center gap-1">
              <Heart className="w-4 h-4" />
              Donasi Saya
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Beri Tips</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <TipWidget user={user} />
              </DropdownMenuContent>
            </DropdownMenu>
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold">
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>Hi, {user.name}</span>
                      {pendingPayments.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white">
                          {pendingPayments.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <DropdownMenuLabel className="px-3 py-2 text-slate-900">
                      Profil & Notifikasi
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => (onNavigate && onNavigate('panel'))} className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">Buka Panel</p>
                          <p className="truncate text-xs text-slate-500">Kelola akun dan kampanye Anda</p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {pendingPayments.length > 0 ? (
                      pendingPayments.map((payment) => (
                        <DropdownMenuItem
                          key={`${payment.orderId}-${payment.donationId}`}
                          onClick={() => onOpenPendingPayment?.(payment)}
                          className="px-3 py-3"
                        >
                          <div className="flex w-full items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                              <Bell className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">Pembayaran pending</p>
                                <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              <p className="truncate text-xs text-slate-500">{payment.campaignTitle}</p>
                              <p className="text-xs font-semibold text-amber-700">Rp {payment.amount.toLocaleString('id-ID')}</p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-slate-400" />
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-slate-500">
                        Tidak ada pembayaran pending.
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout} className="px-3 py-3 text-rose-700">
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <button onClick={() => (onNavigate && onNavigate('login'))} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Masuk
                </button>
                <button onClick={() => (onNavigate && onNavigate('buat-kampanye'))} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Mulai Kampanye
                </button>
              </>
            )}
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3">
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('kampanye'); }} className="block py-2 text-gray-700 w-full text-left">Kampanye</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('cara-kerja'); }} className="block py-2 text-gray-700 w-full text-left">Cara Kerja</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('donasi-saya'); }} className="block py-2 text-gray-700 w-full text-left">Donasi Saya</button>
            {user && pendingPayments.length > 0 && (
              <button onClick={() => { setMobileMenuOpen(false); onOpenPendingPayment?.(pendingPayments[0]); }} className="block py-2 text-amber-700 w-full text-left">Pembayaran Pending ({pendingPayments.length})</button>
            )}
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('login'); }} className="w-full py-2 text-gray-700 border rounded-lg">Masuk</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('buat-kampanye'); }} className="w-full py-2 bg-blue-600 text-white rounded-lg">Mulai Kampanye</button>
          </div>
        )}
      </div>
    </nav>
    </>
  );
}
