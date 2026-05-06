import { useEffect, useState } from 'react';
import { X, CreditCard, Check, Calendar, Loader } from 'lucide-react';

const isDemoPaymentMode = String(import.meta.env.VITE_PAYMENT_DEMO || '').toLowerCase() === 'true';
const apiBaseUrl = String(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const midtransClientKey = String(import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '').trim();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: Record<string, unknown>) => void;
    };
  }
}

const ensureMidtransSnapLoaded = async () => {
  if (window.snap) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-midtrans-snap="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Gagal memuat Midtrans Snap SDK')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://app.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', midtransClientKey);
    script.setAttribute('data-midtrans-snap', 'true');
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat Midtrans Snap SDK'));
    document.body.appendChild(script);
  });
};

const formatNumberWithSeparators = (value: string) => {
  if (!value) {
    return '';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('id-ID') : value;
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
  campaignTitle: string;
  user?: { id?: number; name: string; email?: string } | null;
  onDonationSuccess?: (amount: number, donorInfo: {name: string; message: string}) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  user,
  onDonationSuccess
}: PaymentModalProps) {
  const [step, setStep] = useState<'identity' | 'amount' | 'payment' | 'success' | 'error'>('identity');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [donorName, setDonorName] = useState(user?.name ?? '');
  const [donorEmail, setDonorEmail] = useState(user?.email ?? '');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorMessage, setDonorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [donationId, setDonationId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [transactionToken, setTransactionToken] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'virtual_account' | 'card' | 'ewallet'>('bank_transfer');

  const resetForm = () => {
    setStep('identity');
    setAmount('');
    setIsRecurring(false);
    setDonorName(user?.name ?? '');
    setDonorEmail(user?.email ?? '');
    setIsAnonymous(false);
    setDonorMessage('');
    setError('');
    setDonationId(null);
    setOrderId('');
    setTransactionId('');
    setTransactionToken('');
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const quickAmounts = [50000, 100000, 250000, 500000, 1000000];

  const handleIdentityNext = () => {
    const trimmedName = donorName.trim();
    const trimmedEmail = donorEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      setError('Nama dan email harus diisi');
      return;
    }

    if (!emailPattern.test(trimmedEmail)) {
      setError('Email tidak valid');
      return;
    }

    setDonorName(trimmedName);
    setDonorEmail(trimmedEmail);

    setStep('amount');
  };

  const handleCreatePaymentIntent = async () => {
    if (!amount || Number(amount) < 10000) {
      setError('Minimal donasi Rp 10.000');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          amount: Number(amount),
          campaignId,
          recurringType: isRecurring ? 'monthly' : 'one-time',
          donorName: isAnonymous ? 'Anonymous' : donorName,
          donorEmail,
          isAnonymous,
          message: donorMessage,
          paymentMethod
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal membuat transaksi pembayaran');
      }

      const data = await response.json();
      setDonationId(Number(data.donationId));
      setOrderId(data.orderId || '');
      setTransactionId(data.transactionId || '');
      setTransactionToken(data.transactionToken || '');
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!donationId) {
      setError('Transaksi belum siap. Silakan ulangi dari langkah nominal.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!isDemoPaymentMode) {
        if (!transactionToken) {
          throw new Error('Token pembayaran Midtrans tidak tersedia');
        }
        if (!midtransClientKey) {
          throw new Error('VITE_MIDTRANS_CLIENT_KEY belum diisi di .env');
        }

        await ensureMidtransSnapLoaded();
        if (!window.snap) {
          throw new Error('Midtrans Snap SDK belum siap');
        }

        setLoading(false);
        window.snap.pay(transactionToken, {
          onSuccess: async (result: Record<string, unknown>) => {
            try {
              const response = await fetch(`${apiBaseUrl}/api/payments/confirm`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({
                  donationId,
                  orderId,
                  transactionId: String(result.transaction_id || transactionId || '')
                })
              });

              if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || 'Konfirmasi pembayaran gagal');
              }

              const donationAmount = Number(amount);
              setSuccessMessage(`Donasi Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses`);
              onDonationSuccess?.(donationAmount, {
                name: isAnonymous ? 'Anonymous' : donorName,
                message: donorMessage
              });
              setStep('success');
              setTimeout(() => {
                onClose();
                resetForm();
              }, 3000);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Konfirmasi pembayaran gagal');
              setStep('error');
            }
          },
          onPending: () => {
            setSuccessMessage('Pembayaran Anda tercatat sebagai pending. Silakan selesaikan pembayaran di channel yang dipilih.');
            setStep('success');
          },
          onError: () => {
            setError('Pembayaran Midtrans gagal. Silakan coba lagi.');
            setStep('error');
          },
          onClose: () => {
            setError('Popup Midtrans ditutup sebelum pembayaran selesai.');
            setStep('error');
          }
        });
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/payments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          donationId,
          orderId,
          transactionId
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Konfirmasi pembayaran gagal');
      }

      const donationAmount = Number(amount);
      setSuccessMessage(`Simulasi donasi Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses (metode: ${paymentMethod})`);
      onDonationSuccess?.(donationAmount, {
        name: isAnonymous ? 'Anonymous' : donorName,
        message: donorMessage
      });
      setStep('success');
      
      setTimeout(() => {
        onClose();
        resetForm();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pembayaran gagal');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur">
          <div>
            <h2 className="font-semibold text-xl text-slate-900">Donasi untuk {campaignTitle}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 'identity' && (
            <>
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-slate-900 placeholder-slate-400"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-600"
                  />
                  <span className="text-sm text-slate-600">Donasi secara anonim</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pesan dan Doa (Opsional)
                  </label>
                  <textarea
                    value={donorMessage}
                    onChange={(e) => setDonorMessage(e.target.value)}
                    rows={4}
                    placeholder="Tulis pesan dukungan atau doa untuk penerima bantuan"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleIdentityNext}
                disabled={!donorName.trim() || !donorEmail.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
              >
                Lanjut ke Nominal Donasi
              </button>
            </>
          )}

          {step === 'amount' && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nominal Donasi
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithSeparators(amount)}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {quickAmounts.map((value) => (
                  <button
                    key={value}
                    onClick={() => setAmount(value.toString())}
                    className="py-2 px-3 border border-slate-300 rounded-lg hover:border-blue-600 hover:text-blue-700 text-slate-700 text-sm bg-white"
                  >
                    Rp {formatNumberWithSeparators(String(value))}
                  </button>
                ))}
              </div>

              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-600"
                  />
                  <div>
                    <div className="flex items-center gap-2 font-medium text-amber-800 mb-1">
                      <Calendar className="w-4 h-4" />
                      Jadikan Donasi Rutin
                    </div>
                    <p className="text-sm text-amber-700">
                      Donasi Anda akan otomatis dilakukan setiap bulan untuk membantu berkelanjutan
                    </p>
                  </div>
                </label>
                {isRecurring && (
                  <div className="mt-3 ml-7 text-sm text-slate-600">
                    Donasi rutin akan dijalankan setiap bulan.
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('identity')}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCreatePaymentIntent}
                  disabled={!amount || Number(amount) < 10000 || loading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Lanjut ke Pembayaran'}
                </button>
              </div>
            </>
          )}

          {step === 'payment' && (
            <form onSubmit={handlePayment}>
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">Jumlah Donasi:</span>
                  <span className="font-semibold text-slate-900">
                    Rp {Number(amount || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                {isRecurring && (
                  <div className="text-sm text-amber-700 flex items-center gap-1 mt-2">
                    <Calendar className="w-4 h-4" />
                    Donasi Rutin Bulanan
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Pilih Metode Pembayaran</h3>
                
                {isDemoPaymentMode ? (
                  <div className="space-y-2">
                    {/* E-Wallet Section */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'ewallet' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="ewallet" checked={paymentMethod === 'ewallet'} onChange={() => setPaymentMethod('ewallet')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">E-Wallet</div>
                          <div className="text-sm text-slate-500">GoPay, OVO, DANA, ShopeePay</div>
                        </div>
                      </div>
                    </label>

                    {/* Virtual Account Section */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'virtual_account' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="virtual_account" checked={paymentMethod === 'virtual_account'} onChange={() => setPaymentMethod('virtual_account')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">Virtual Account</div>
                          <div className="text-sm text-slate-500">BCA, Mandiri, BNI, BRI</div>
                        </div>
                      </div>
                    </label>

                    {/* Bank Transfer */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">Bank Transfer</div>
                          <div className="text-sm text-slate-500">Transfer langsung dari rekening bank</div>
                        </div>
                      </div>
                    </label>

                    {/* Card */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">Kartu Kredit/Debit</div>
                          <div className="text-sm text-slate-500">Visa, Mastercard, dan sejenisnya</div>
                        </div>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* E-Wallet Section */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'ewallet' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="ewallet" checked={paymentMethod === 'ewallet'} onChange={() => setPaymentMethod('ewallet')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">E-Wallet</div>
                          <div className="text-sm text-slate-500">GoPay, OVO, DANA, ShopeePay</div>
                        </div>
                      </div>
                    </label>

                    {/* Virtual Account Section */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'virtual_account' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="virtual_account" checked={paymentMethod === 'virtual_account'} onChange={() => setPaymentMethod('virtual_account')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">Virtual Account</div>
                          <div className="text-sm text-slate-500">BCA, Mandiri, BNI, BRI</div>
                        </div>
                      </div>
                    </label>

                    {/* Bank Transfer */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">Bank Transfer</div>
                          <div className="text-sm text-slate-500">Transfer langsung dari rekening bank</div>
                        </div>
                      </div>
                    </label>

                    {/* Card */}
                    <label className={`p-4 border-2 rounded-xl cursor-pointer transition ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="method" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="mt-1 w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">Kartu Kredit/Debit</div>
                          <div className="text-sm text-slate-500">Visa, Mastercard, dan sejenisnya</div>
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {!isDemoPaymentMode && (
                <div className="mb-6 p-3 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-600">
                  {orderId ? `Order ID: ${orderId}` : 'Order ID belum tersedia'}
                </div>
              )}

              {isDemoPaymentMode && (
                <div className="mb-6 p-3 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-600">
                  {orderId ? `Order ID: ${orderId}` : 'Order ID belum tersedia'}
                  <div className="mt-1">Transaction ID: {transactionId || '-'}</div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('amount')}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" />{isDemoPaymentMode ? 'Simulasikan Pembayaran' : 'Bayar dengan Midtrans'}</>}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-xl text-slate-900 mb-2">
                Terima Kasih!
              </h3>
              <p className="text-slate-600 mb-4">
                {successMessage}
              </p>
              {isRecurring && (
                <p className="text-sm text-amber-700">
                  ✓ Donasi rutin bulanan telah diaktifkan
                </p>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-semibold text-xl text-slate-900 mb-2">
                Pembayaran Gagal
              </h3>
              <p className="text-red-700 mb-4">
                {error}
              </p>
              <button
                onClick={() => setStep('payment')}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
