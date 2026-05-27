import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader, RefreshCw, ShieldAlert, CheckCircle2, Clock3, XCircle, Copy } from 'lucide-react';

const apiBaseUrl = String(((import.meta as any).env && (import.meta as any).env.VITE_API_URL) || 'http://localhost:8080').replace(/\/$/, '');
const midtransClientKey = String(((import.meta as any).env && (import.meta as any).env.VITE_MIDTRANS_CLIENT_KEY) || '').trim();
const viteMidtransIsProduction = String(((import.meta as any).env && (import.meta as any).env.VITE_MIDTRANS_IS_PRODUCTION) || '').toLowerCase() === 'true';
const pendingPaymentsKey = 'bantusesama-pending-payments';

type PaymentStatusResponse = {
  status?: string;
  paymentStatus?: string;
  amount?: number | string;
  orderId?: string;
};

const toTitle = (value: string | null) => value || 'Pembayaran';

const getQueryDetails = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get('orderId') || '',
    donationId: params.get('donationId') || '',
    method: params.get('method') || 'ewallet',
    campaignTitle: params.get('campaignTitle') || '',
    redirectUrl: params.get('redirectUrl') || '',
    amount: params.get('amount') || ''
  };
};

type PendingPaymentRecord = {
  donationId: number;
  orderId: string;
  campaignTitle: string;
  amount: number;
  tipAmount?: number;
  method: 'virtual_account' | 'ewallet';
  transactionToken?: string;
  redirectUrl?: string;
  ownerEmail?: string;
  createdAt: number;
  updatedAt: number;
};

const ensureSnapLoaded = async () => {
  if ((window as any).snap) return;

  const existing = document.querySelector('script[data-midtrans-snap="true"]');
  if (!existing) {
    const snapUrl = viteMidtransIsProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    const script = document.createElement('script');
    script.src = snapUrl;
    script.setAttribute('data-client-key', midtransClientKey);
    script.setAttribute('data-midtrans-snap', 'true');
    script.async = true;
    document.body.appendChild(script);
  }

  return new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const max = 100; // ~10s
    const check = () => {
      attempts++;
      if ((window as any).snap) return resolve();
      if (attempts >= max) return reject(new Error('Timeout: Midtrans Snap SDK tidak siap'));
      setTimeout(check, 100);
    };
    check();
  });
};

const readPendingPayments = () => {
  try {
    const raw = window.localStorage.getItem(pendingPaymentsKey);
    return raw ? JSON.parse(raw) as PendingPaymentRecord[] : [];
  } catch {
    return [] as PendingPaymentRecord[];
  }
};

const removePendingPayment = (donationId: string | number, orderId: string) => {
  const numericDonationId = Number(donationId || 0);
  const nextPayments = readPendingPayments().filter(
    (item) => !(item.donationId === numericDonationId && item.orderId === orderId)
  );
  window.localStorage.setItem(pendingPaymentsKey, JSON.stringify(nextPayments));
  window.dispatchEvent(new StorageEvent('storage', { key: pendingPaymentsKey, newValue: JSON.stringify(nextPayments) }));
};

export function ContinuePaymentPage({ onHome, user }: { onHome: () => void; user?: { name: string; email?: string } | null }) {
  const query = useMemo(getQueryDetails, []);
  const [status, setStatus] = useState<string>('pending');
  const [message, setMessage] = useState('Halaman ini dipakai untuk melanjutkan pembayaran yang masih pending.');
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const refreshStatus = async () => {
    if (!query.orderId) {
      setError('Order ID belum tersedia.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/payments/status/${encodeURIComponent(query.orderId)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal mengambil status pembayaran');
      }

      const data = (await response.json()) as PaymentStatusResponse;
      const nextStatus = String(data.paymentStatus || data.status || 'pending').toLowerCase();
      setStatus(nextStatus);

      if (nextStatus === 'succeeded') {
        setMessage('Pembayaran sudah berhasil tercatat.');
        removePendingPayment(query.donationId, query.orderId);
      } else if (nextStatus === 'processing') {
        setMessage('Pembayaran sedang diproses. Tunggu beberapa saat lalu cek lagi.');
      } else if (nextStatus === 'failed') {
        setMessage('Pembayaran dibatalkan atau gagal.');
        removePendingPayment(query.donationId, query.orderId);
      } else {
        setMessage('Pembayaran masih pending. Silakan lanjutkan pembayaran di channel yang dipilih.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil status pembayaran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const continuePayment = () => {
    (async () => {
      let urlToOpen = query.redirectUrl;

      console.log('continuePayment - Initial state:', {
        queryRedirectUrl: query.redirectUrl,
        queryDonationId: query.donationId
      });

      // Fallback: cari di localStorage jika redirectUrl atau snap token tidak ada di URL
      if (!urlToOpen && query.donationId) {
        const pendingPayments = readPendingPayments();
        console.log('Fallback - Pending payments from localStorage:', pendingPayments);
        const matchingPayment = pendingPayments.find(
          (p) => p.donationId === Number(query.donationId)
        );
        console.log('Fallback - Matching payment found:', matchingPayment);

        // Jika ada Snap token tersimpan, coba buka kembali popup Snap agar user bisa menyelesaikan pembayaran
        if (matchingPayment?.transactionToken) {
          try {
            setLoading(true);
            await ensureSnapLoaded();
            const token = matchingPayment.transactionToken;
            let callbackFired = false;
            const snapTimeout = window.setTimeout(() => {
              if (!callbackFired) {
                setError('Pembayaran tidak bisa dilanjutkan saat ini. Silakan coba lagi beberapa saat.');
              }
              setLoading(false);
            }, 10000);

            (window as any).snap.pay(token, {
              onSuccess: async (result: Record<string, unknown>) => {
                callbackFired = true;
                clearTimeout(snapTimeout);
                try {
                  const response = await fetch(`${apiBaseUrl}/api/payments/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      donationId: Number(matchingPayment.donationId),
                      orderId: String(matchingPayment.orderId),
                      transactionId: String(result.transaction_id || ''),
                      transactionStatus: String(result.transaction_status || '')
                    })
                  });

                  if (response.ok) {
                    setStatus('succeeded');
                    setMessage('Pembayaran sudah berhasil tercatat.');
                    removePendingPayment(matchingPayment.donationId, matchingPayment.orderId);
                  } else {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || 'Konfirmasi pembayaran gagal');
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Konfirmasi pembayaran gagal');
                } finally {
                  setLoading(false);
                }
              },
              onPending: (result: Record<string, unknown>) => {
                callbackFired = true;
                clearTimeout(snapTimeout);
                setMessage('Pembayaran masih pending. Silakan selesaikan pembayaran di channel yang dipilih.');
                setLoading(false);
              },
              onError: (res?: Record<string, unknown>) => {
                callbackFired = true;
                clearTimeout(snapTimeout);
                setError('Pembayaran Midtrans gagal. Silakan coba lagi.');
                setLoading(false);
              },
              onClose: () => {
                callbackFired = true;
                clearTimeout(snapTimeout);
                setError('Pembayaran dibatalkan. Silakan coba lagi jika ingin melanjutkan donasi.');
                setLoading(false);
              }
            });

            return;
          } catch (err) {
            setLoading(false);
            console.error('continuePayment - ensureSnapLoaded failed', err);
            setError('Midtrans Snap SDK tidak siap. Silakan coba lagi beberapa saat.');
            return;
          }
        }

        if (matchingPayment?.redirectUrl) {
          urlToOpen = matchingPayment.redirectUrl;
        }
      }

      console.log('continuePayment - Final urlToOpen:', urlToOpen);

      if (urlToOpen) {
        console.log('Opening URL:', urlToOpen);
        window.open(urlToOpen, '_blank', 'noopener,noreferrer');
        return;
      }

      setError('Link pembayaran belum tersedia. Pastikan Anda membuka halaman ini dari notifikasi atau coba cek status pembayaran terlebih dahulu.');
    })();
  };

  const cancelPayment = async () => {
    if (!user?.email) {
      setError('Silakan login untuk membatalkan pembayaran dari halaman ini.');
      return;
    }

    const donationIdNum = Number(query.donationId || 0);
    if (!query.donationId || donationIdNum === 0) {
      setError('Donation ID belum tersedia untuk pembatalan.');
      return;
    }

    const confirmed = window.confirm('Batalkan pembayaran pending ini?');
    if (!confirmed) {
      return;
    }

    setCanceling(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/payments/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ donationId: donationIdNum, orderId: query.orderId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal membatalkan pembayaran');
      }

      setStatus('failed');
      setMessage('Pembayaran berhasil dibatalkan.');
      removePendingPayment(query.donationId, query.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan pembayaran');
    } finally {
      setCanceling(false);
    }
  };

  const copyOrderId = async () => {
    if (!query.orderId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(query.orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Gagal menyalin Order ID');
    }
  };

  const badge = (() => {
    if (status === 'succeeded') return { label: 'Berhasil', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
    if (status === 'failed') return { label: 'Dibatalkan', tone: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle };
    if (status === 'processing') return { label: 'Diproses', tone: 'bg-blue-100 text-blue-700 border-blue-200', icon: ShieldAlert };
    return { label: 'Pending', tone: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock3 };
  })();

  const StatusIcon = badge.icon;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff,_#eef4ff_45%,_#eef2ff_100%)] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </button>

        <div className="mt-8 grid gap-6">
          <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">Lanjutkan Pembayaran</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{toTitle(query.campaignTitle)}</h1>
                <p className="mt-3 max-w-2xl text-slate-600">
                  Halaman ini membantu Anda menyelesaikan pembayaran yang masih pending dari notifikasi Midtrans.
                </p>
              </div>

              <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${badge.tone}`}>
                <StatusIcon className="h-4 w-4" />
                {badge.label}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Metode</p>
                <p className="mt-2 font-semibold text-slate-900">{query.method === 'virtual_account' ? 'Virtual Account' : 'E-Wallet'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Nominal</p>
                <p className="mt-2 font-semibold text-slate-900">{query.amount ? `Rp ${Number(query.amount).toLocaleString('id-ID')}` : '-'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Order ID</p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-semibold text-slate-900">{query.orderId || '-'}</p>
                  {query.orderId && (
                    <button
                      type="button"
                      onClick={copyOrderId}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      aria-label="Salin Order ID"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {copied && <p className="mt-2 text-xs font-medium text-emerald-600">Order ID disalin</p>}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/80 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Apa yang harus dilakukan?</h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>1. Tekan tombol Lanjutkan Pembayaran untuk membuka notifikasi atau halaman pembayaran yang sesuai.</li>
                <li>2. Selesaikan pembayaran di aplikasi e-wallet atau mobile banking.</li>
                <li>3. Jika status masih pending, tekan Cek Status beberapa saat kemudian.</li>
              </ol>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={continuePayment}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                Lanjutkan Pembayaran
              </button>
              <button
                type="button"
                onClick={refreshStatus}
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Cek Status
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Batalkan Jika Perlu</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Kalau Anda tidak jadi membayar, transaksi pending bisa dibatalkan supaya tidak menggantung di sistem.
              </p>
              <button
                type="button"
                onClick={cancelPayment}
                disabled={canceling || !user?.email}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {canceling ? <Loader className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Batalkan Pembayaran
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}