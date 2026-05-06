import { useEffect, useState } from 'react';
import { X, CreditCard, Smartphone, Building2, Check, Calendar, Loader } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';

const isDemoPaymentMode = String(import.meta.env.VITE_PAYMENT_DEMO || '').toLowerCase() === 'true';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function PaymentFormContent({ 
  isOpen, 
  onClose, 
  campaignId, 
  campaignTitle, 
  user,
  onDonationSuccess
}: PaymentModalProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [step, setStep] = useState<'identity' | 'amount' | 'payment' | 'success' | 'error'>('identity');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [donorName, setDonorName] = useState(user?.name ?? '');
  const [donorEmail, setDonorEmail] = useState(user?.email ?? '');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorMessage, setDonorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [donationId, setDonationId] = useState('');
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
    setClientSecret('');
    setPaymentIntentId('');
    setDonationId('');
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
    if (!isDemoPaymentMode && (!stripe || !elements)) {
      setError('Stripe belum siap');
      return;
    }

    if (!amount || Number(amount) < 10000) {
      setError('Minimal donasi Rp 10.000');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isDemoPaymentMode) {
        // Demo mode: Generate mock payment intent locally
        const mockId = `mock_intent_${Date.now()}`;
        setClientSecret(`mock_secret_${Date.now()}`);
        setPaymentIntentId(mockId);
        setDonationId(`donation_${Date.now()}`);
        setStep('payment');
      } else {
        // Production mode: Call backend to create payment intent
        const response = await fetch(import.meta.env.VITE_API_URL + '/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            amount: Number(amount),
            campaignId,
            recurringType: isRecurring ? 'monthly' : 'one-time',
            donorName: isAnonymous ? 'Anonymous' : donorName,
            donorEmail,
            isAnonymous,
            message: donorMessage,
            currency: 'IDR'
          })
        });

        if (!response.ok) {
          throw new Error('Gagal membuat payment intent');
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setDonationId(data.donationId);
        setStep('payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDemoPaymentMode && (!stripe || !elements || !clientSecret)) {
      setError('Stripe belum siap');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isDemoPaymentMode) {
        await fetch(import.meta.env.VITE_API_URL + '/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify({
            paymentIntentId,
            donationId,
            method: paymentMethod
          })
        });

        const donationAmount = Number(amount);
        setSuccessMessage(`Simulasi donasi Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses (metode: ${paymentMethod})`);
        onDonationSuccess?.(donationAmount, {
          name: isAnonymous ? 'Anonymous' : donorName,
          message: donorMessage
        });
        setStep('success');
      } else {
        // Confirm payment
        const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: donorName,
              email: donorEmail
            }
          }
        });

        if (paymentError) {
          setError(paymentError.message || 'Pembayaran gagal');
          setStep('error');
        } else if (paymentIntent?.status === 'succeeded') {
          const donationAmount = Number(amount);
          // Notify backend of successful payment
          await fetch(import.meta.env.VITE_API_URL + '/api/payments/confirm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
              paymentIntentId,
              donationId
            })
          });

          setSuccessMessage(`Donasi Anda sebesar Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses`);
          onDonationSuccess?.(donationAmount, {
            name: isAnonymous ? 'Anonymous' : donorName,
            message: donorMessage
          });
          setStep('success');
        }
      }
      
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

              {isDemoPaymentMode ? (
                <div className="mb-6 space-y-3">

                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-3 border rounded-lg cursor-pointer ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
                      <input type="radio" name="method" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} className="mr-2" /> Bank Transfer
                      <div className="text-xs text-slate-500">Proses manual via transfer bank</div>
                    </label>
                    <label className={`p-3 border rounded-lg cursor-pointer ${paymentMethod === 'virtual_account' ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
                      <input type="radio" name="method" value="virtual_account" checked={paymentMethod === 'virtual_account'} onChange={() => setPaymentMethod('virtual_account')} className="mr-2" /> Virtual Account
                      <div className="text-xs text-slate-500">VA (otomatis cek pembayaran)</div>
                    </label>
                    <label className={`p-3 border rounded-lg cursor-pointer ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
                      <input type="radio" name="method" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="mr-2" /> Kartu (simulasi)
                      <div className="text-xs text-slate-500">Simulasi kartu kredit/debit</div>
                    </label>
                    <label className={`p-3 border rounded-lg cursor-pointer ${paymentMethod === 'ewallet' ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
                      <input type="radio" name="method" value="ewallet" checked={paymentMethod === 'ewallet'} onChange={() => setPaymentMethod('ewallet')} className="mr-2" /> E-Wallet
                      <div className="text-xs text-slate-500">Contoh: OVO / Dana (simulasi)</div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <CreditCard className="w-4 h-4 inline-block mr-2" />
                    Kartu Kredit / Debit
                  </label>
                  <div className="p-4 border border-slate-300 rounded-lg bg-white">
                    <CardElement
                      options={{
                        style: {
                          base: {
                            color: '#0f172a',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '16px',
                            '::placeholder': {
                              color: '#94a3b8'
                            }
                          },
                          invalid: {
                            color: '#ef4444'
                          }
                        }
                      }}
                    />
                  </div>
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
                  disabled={loading || (!isDemoPaymentMode && (!stripe || !elements))}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" />{isDemoPaymentMode ? 'Simulasikan Pembayaran' : 'Bayar Sekarang'}</>}
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

export function PaymentModal(props: PaymentModalProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent {...props} />
    </Elements>
  );
}
