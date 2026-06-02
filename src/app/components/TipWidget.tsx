import { useEffect, useState, useRef } from 'react';
import { apiUrl, getApiBaseUrl } from '../lib/apiBaseUrl';

const apiBaseUrl = getApiBaseUrl();
const midtransClientKey = String(((import.meta as any).env && (import.meta as any).env.VITE_MIDTRANS_CLIENT_KEY) || '').trim();
const viteMidtransIsProduction = String(((import.meta as any).env && (import.meta as any).env.VITE_MIDTRANS_IS_PRODUCTION) || '').toLowerCase() === 'true';

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: Record<string, unknown>) => void;
    };
  }
}

const preloadMidtransSnap = () => {
  if (window.snap) return;
  const existing = document.querySelector('script[data-midtrans-snap="true"]');
  if (existing) return;
  const snapUrl = viteMidtransIsProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
  const script = document.createElement('script');
  script.src = snapUrl;
  script.setAttribute('data-client-key', midtransClientKey);
  script.setAttribute('data-midtrans-snap', 'true');
  script.async = true;
  document.body.appendChild(script);
};

const ensureSnapLoaded = async () => {
  if (window.snap) return;
  return new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const max = 100; // ~10s
    const check = () => {
      attempts++;
      if (window.snap) return resolve();
      if (attempts >= max) return reject(new Error('Timeout: Midtrans Snap SDK tidak siap'));
      setTimeout(check, 100);
    };
    check();
  });
};

export function TipWidget({ user }: { user?: { name?: string; email?: string } | null }) {
  const quickTips = [5000, 10000, 20000, 50000];
  const [amount, setAmount] = useState('10000');
  const [donorName, setDonorName] = useState(user?.name ?? '');
  const [donorEmail, setDonorEmail] = useState(user?.email ?? '');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const paymentCompletionRef = useRef(false);

  useEffect(() => preloadMidtransSnap(), []);

  const handleTip = async () => {
    setError('');
    setSuccess('');
    if (!donorName.trim() || !donorEmail.trim()) {
      setError('Nama dan email harus diisi');
      return;
    }

    const numeric = Math.round(Number(amount || 0));
    if (!numeric || numeric < 1000) {
      setError('Pilih nominal tip yang valid');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(apiUrl('/api/payments/create-tip-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numeric, donorName, donorEmail, isAnonymous, message: 'Tips Sukarela', paymentMethod: 'ewallet' })
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => null);
        let body = {} as any;
        try { body = text ? JSON.parse(text) : {}; } catch (e) { body = {}; }
        const serverMsg = (body && body.error) || text || `HTTP ${resp.status}`;
        throw new Error(serverMsg || 'Gagal membuat transaksi tip');
      }
      const data = await resp.json();

      const isDemoTransaction = Boolean(data.demoMode) || !midtransClientKey || String(data.transactionToken || '').startsWith('DEMO_');

      if (isDemoTransaction) {
        try {
          const confirmResp = await fetch(apiUrl('/api/payments/confirm'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipId: data.tipId,
              orderId: data.orderId,
              transactionStatus: 'settlement'
            })
          });

          if (!confirmResp.ok) {
            const text = await confirmResp.text().catch(() => null);
            let body = {} as any;
            try { body = text ? JSON.parse(text) : {}; } catch (e) { body = {}; }
            const serverMsg = (body && body.error) || text || 'Gagal mencatat tip di server';
            throw new Error(serverMsg);
          }

          setSuccess(`Terima kasih! Tips Rp ${numeric.toLocaleString('id-ID')} berhasil tercatat.`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Gagal mencatat tip di server');
        }
        return;
      }

      // Otherwise proceed with Midtrans Snap
      const token = data.transactionToken;
      await ensureSnapLoaded();
      window.snap!.pay(token, {
        onSuccess: async (result: Record<string, any>) => {
          paymentCompletionRef.current = true;
          try {
            await fetch(apiUrl('/api/payments/confirm'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipId: data.tipId, orderId: data.orderId, transactionStatus: String(result.transaction_status || '') }) });
            setSuccess(`Terima kasih! Tips Rp ${numeric.toLocaleString('id-ID')} berhasil.`);
          } catch (err) {
            setError('Konfirmasi pembayaran gagal');
          }
        },
        onPending: (result: Record<string, any>) => {
          paymentCompletionRef.current = true;
          setSuccess('Pembayaran tip tercatat sebagai pending. Silakan selesaikan di channel pembayaran.');
        },
        onError: (res?: Record<string, any>) => {
          setError('Pembayaran gagal. Silakan coba lagi.');
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white shadow p-4">
      <h4 className="font-semibold mb-2">Beri Tips untuk Operasional Platform</h4>
      <p className="text-sm text-slate-600 mb-3">Tips akan digunakan untuk biaya pengembangan dan operasional.</p>

      <div className="flex gap-2 mb-3 flex-wrap">
        {quickTips.map((v) => (
          <button key={v} onClick={() => setAmount(String(v))} className="px-2 py-1 border rounded bg-slate-50 text-sm">Rp {v.toLocaleString('id-ID')}</button>
        ))}
      </div>

      <div className="mb-3">
        <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} className="w-full px-3 py-2 border rounded" />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <input type="text" placeholder="Nama" value={donorName} onChange={(e) => setDonorName(e.target.value)} className="px-3 py-2 border rounded" />
        <input type="email" placeholder="Email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} className="px-3 py-2 border rounded" />
      </div>

      <label className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
        <span className="text-sm">Donasi anonim</span>
      </label>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-3 text-sm text-emerald-700">{success}</div>}

      <button onClick={handleTip} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded">
        {loading ? 'Memproses...' : `Kirim Tips Rp ${Number(amount || 0).toLocaleString('id-ID')}`}
      </button>
    </div>
  );
}
