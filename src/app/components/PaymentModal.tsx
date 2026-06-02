import { useEffect, useRef, useState } from 'react';
import { X, CreditCard, Check, Calendar, Loader, Clock3, RefreshCw, ExternalLink } from 'lucide-react';

<<<<<<< HEAD
function resolveApiBaseUrl() {
  const envBaseUrl = String((import.meta as any).env?.VITE_API_URL || '').trim();

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return 'http://localhost:4000';
}

const apiBaseUrl = resolveApiBaseUrl();
=======
import { apiUrl, getApiBaseUrl } from '../lib/apiBaseUrl';

const apiBaseUrl = getApiBaseUrl();
>>>>>>> 280e85d7315dd39666e8bdf49ec1442e64d22120
const midtransClientKey = String(((import.meta as any).env && (import.meta as any).env.VITE_MIDTRANS_CLIENT_KEY) || '').trim();
const viteMidtransIsProduction = String(((import.meta as any).env && (import.meta as any).env.VITE_MIDTRANS_IS_PRODUCTION) || '').toLowerCase() === 'true';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapToPaymentErrorMessage = (err: unknown, fallbackMessage: string) => {
  const rawMessage = err instanceof Error ? String(err.message || '') : String(err || '');
  const normalized = rawMessage.trim().toLowerCase();

  if (!normalized) {
    return fallbackMessage;
  }

  if (
    normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('network request failed')
    || normalized.includes('load failed')
  ) {
    return 'Koneksi ke server pembayaran gagal. Periksa koneksi internet atau konfigurasi API, lalu coba lagi.';
  }

  return rawMessage;
};

// Log env vars for debugging
console.log('[PaymentModal] Env vars loaded:', {
  apiBaseUrl,
  midtransClientKeyPrefix: midtransClientKey.slice(0, 10),
  viteMidtransIsProduction
});

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: Record<string, unknown>) => void;
      hide?: () => void;
      reset?: () => void;
    };
  }
}

// Preload Snap script immediately
const preloadMidtransSnap = () => {
  if (window.snap) {
    console.log('[Midtrans] Snap SDK already loaded');
    return;
  }

  const existing = document.querySelector('script[data-midtrans-snap="true"]');
  if (existing) {
    console.log('[Midtrans] Snap script tag already exists');
    return;
  }

  const snapUrl = viteMidtransIsProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
  if (!viteMidtransIsProduction) {
    console.warn('[Midtrans] Sandbox mode active, TEST ribbon is expected until production mode is enabled');
  }
  console.log('[Midtrans] Preloading Snap SDK from', snapUrl);
  
  const script = document.createElement('script');
  script.src = snapUrl;
  script.setAttribute('data-client-key', midtransClientKey);
  script.setAttribute('data-midtrans-snap', 'true');
  script.async = true;
  script.onload = () => {
    console.log('[Midtrans] Snap SDK loaded successfully, window.snap:', typeof window.snap);
  };
  script.onerror = (err) => {
    console.error('[Midtrans] Failed to load Snap SDK from', snapUrl, err);
  };
  document.body.appendChild(script);
  console.log('[Midtrans] Script tag appended to body');
};

// Call preload immediately
preloadMidtransSnap();

const ensureMidtransSnapLoaded = async () => {
  if (window.snap) {
    console.log('[Midtrans] window.snap available');
    return;
  }

  console.log('[Midtrans] Waiting for Snap SDK to load...');
  
  // Wait for script to load (max 10 seconds)
  return new Promise<void>((resolve, reject) => {
    let checkCount = 0;
    const maxChecks = 100; // 100 * 100ms = 10 seconds
    
    const checkSnap = () => {
      checkCount++;
      if (window.snap) {
        console.log('[Midtrans] Snap SDK detected after', checkCount * 100, 'ms');
        resolve();
      } else if (checkCount >= maxChecks) {
        console.error('[Midtrans] Timeout waiting for Snap SDK');
        reject(new Error('Timeout: Midtrans Snap SDK tidak siap setelah 10 detik'));
      } else {
        setTimeout(checkSnap, 100);
      }
    };
    
    checkSnap();
  });
};

const formatNumberWithSeparators = (value: string) => {
  if (!value) {
    return '';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('id-ID') : value;
};

const recurringDonationsKey = 'bantusesama-recurring-donors';

type RecurringDonationRecord = {
  email: string;
  campaignTitle: string;
  amount: number;
  createdAt: number;
  updatedAt: number;
};

const saveRecurringDonationRecord = (record: RecurringDonationRecord) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const existing = window.localStorage.getItem(recurringDonationsKey);
    const parsed = existing ? (JSON.parse(existing) as RecurringDonationRecord[]) : [];
    const nextRecords = Array.isArray(parsed)
      ? parsed.filter((item) => item.email.toLowerCase() !== record.email.toLowerCase() || item.campaignTitle !== record.campaignTitle)
      : [];

    nextRecords.push(record);
    window.localStorage.setItem(recurringDonationsKey, JSON.stringify(nextRecords));
  } catch (error) {
    console.error('Failed to save recurring donation record', error);
  }
};

type PendingPaymentDetails = {
  transaction_status?: string;
  status?: string;
  redirect_url?: string;
  url?: string;
  va_numbers?: Array<{ bank?: string; va_number?: string }>;
  actions?: Array<{ name?: string; url?: string }>;
  [key: string]: unknown;
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

const pendingPaymentsKey = 'bantusesama-pending-payments';

const readPendingPayments = () => {
  try {
    const raw = window.localStorage.getItem(pendingPaymentsKey);
    const parsed = raw ? (JSON.parse(raw) as PendingPaymentRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as PendingPaymentRecord[];
  }
};

const writePendingPayments = (payments: PendingPaymentRecord[]) => {
  window.localStorage.setItem(pendingPaymentsKey, JSON.stringify(payments));
  window.dispatchEvent(new StorageEvent('storage', { key: pendingPaymentsKey, newValue: JSON.stringify(payments) }));
};

const upsertPendingPayment = (payment: PendingPaymentRecord) => {
  const payments = readPendingPayments();
  const nextPayments = [
    payment,
    ...payments.filter((item) => item.donationId !== payment.donationId && item.orderId !== payment.orderId)
  ];
  writePendingPayments(nextPayments);
};

const removePendingPayment = (paymentId: number, orderId: string) => {
  const payments = readPendingPayments();
  const nextPayments = payments.filter((item) => item.donationId !== paymentId && item.orderId !== orderId);
  writePendingPayments(nextPayments);
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
  campaignTitle: string;
  user?: { id?: number; name: string; email?: string } | null;
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

export function PaymentModal({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  user,
  onDonationSuccess,
  onNavigateToContinuePayment
}: PaymentModalProps) {
  const [step, setStep] = useState<'identity' | 'amount' | 'payment' | 'pending' | 'success' | 'error'>('identity');
  const stepRef = useRef<typeof step>(step);
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
  const [pendingMessage, setPendingMessage] = useState('');
  const [pendingDetails, setPendingDetails] = useState<PendingPaymentDetails | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'virtual_account' | 'ewallet'>('ewallet');
  const [isSnapReady, setIsSnapReady] = useState(!!window.snap);
  const [isDemoPaymentMode, setIsDemoPaymentMode] = useState(false);
  const paymentCompletionRef = useRef(false);
  const pendingErrorTimeoutRef = useRef<number | null>(null);
  const suppressErrorsRef = useRef(false);

  const safeSetError = (msg: string, moveToError = true, delay = 800) => {
    if (paymentCompletionRef.current || suppressErrorsRef.current) {
      console.info('[PaymentModal] Ignored error after completion:', msg);
      return;
    }

    if (pendingErrorTimeoutRef.current) {
      window.clearTimeout(pendingErrorTimeoutRef.current);
      pendingErrorTimeoutRef.current = null;
    }

    pendingErrorTimeoutRef.current = window.setTimeout(() => {
      pendingErrorTimeoutRef.current = null;
      if (paymentCompletionRef.current) {
        console.info('[PaymentModal] Suppressed error because payment completed:', msg);
        return;
      }
      setError(msg);
      if (moveToError) setStep('error');
    }, delay);
  };

  const resetForm = () => {
    paymentCompletionRef.current = false;
    if (pendingErrorTimeoutRef.current) {
      window.clearTimeout(pendingErrorTimeoutRef.current);
      pendingErrorTimeoutRef.current = null;
    }
    suppressErrorsRef.current = false;
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
    setPendingMessage('');
    setPendingDetails(null);
    setCheckingStatus(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!isOpen || step !== 'payment') {
      return;
    }

    if (window.snap) {
      setIsSnapReady(true);
      return;
    }

    let cancelled = false;

    const checkSnapReady = () => {
      if (cancelled) {
        return;
      }

      if (window.snap) {
        setIsSnapReady(true);
        return;
      }

      window.setTimeout(checkSnapReady, 100);
    };

    setIsSnapReady(false);
    checkSnapReady();

    return () => {
      cancelled = true;
    };
  }, [isOpen, step]);

  if (!isOpen) return null;

  const MIN_DONATION = 10000; // Minimum 10k
  const MAX_DONATION = 100000000; // Maximum 100 million
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

  // Move to payment step first. Actual Midtrans transaction/token
  // will be created when the user clicks "Bayar" so the selected
  // payment method is used to generate the correct token.
  const handleCreatePaymentIntent = async () => {
    if (!amount || Number(amount) < MIN_DONATION) {
      setError(`Minimal donasi Rp ${formatNumberWithSeparators(String(MIN_DONATION))}`);
      return;
    }

    if (Number(amount) > MAX_DONATION) {
      setError(`Maksimal donasi Rp ${formatNumberWithSeparators(String(MAX_DONATION))}`);
      return;
    }

    setError('');
    // Clear any previously created transaction/token so selected payment method
    // will be used to create a fresh Midtrans token when user clicks Bayar.
    setDonationId(null);
    setOrderId('');
    setTransactionId('');
    setTransactionToken('');
    setIsDemoPaymentMode(false);
    setStep('payment');
  };

  const handlePaymentMethodChange = (nextMethod: 'virtual_account' | 'ewallet') => {
    setPaymentMethod(nextMethod);
    setDonationId(null);
    setOrderId('');
    setTransactionId('');
    setTransactionToken('');
    setIsDemoPaymentMode(false);
  };

  const completeSuccessfulPayment = (paymentAmount: number, message: string) => {
    paymentCompletionRef.current = true;
    if (pendingErrorTimeoutRef.current) {
      window.clearTimeout(pendingErrorTimeoutRef.current);
      pendingErrorTimeoutRef.current = null;
    }
    if (donationId) {
      removePendingPayment(donationId, orderId);
    }
    setPendingMessage('');
    setPendingDetails(null);
    if (isRecurring && user?.email) {
      saveRecurringDonationRecord({
        email: user.email,
        campaignTitle,
        amount: paymentAmount,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setSuccessMessage(`${message}\nAnda terdaftar sebagai donatur rutin bulanan.`);
    } else {
      setSuccessMessage(message);
    }
    onDonationSuccess?.(paymentAmount, {
      name: isAnonymous ? 'Anonymous' : donorName,
      message: donorMessage
    });
    setStep('success');
  };

  const checkPendingStatus = async () => {
    if (!donationId) {
      safeSetError('Data pembayaran belum lengkap.');
      return;
    }

    // suppress transient errors while actively checking status
    suppressErrorsRef.current = true;
    if (pendingErrorTimeoutRef.current) {
      window.clearTimeout(pendingErrorTimeoutRef.current);
      pendingErrorTimeoutRef.current = null;
    }

    setCheckingStatus(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/payments/confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          donationId,
          orderId,
          transactionId,
          transactionStatus: String(pendingDetails?.transaction_status || pendingDetails?.status || '')
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Konfirmasi pembayaran gagal');
      }

      const result = await response.json();
      if (result.paymentStatus === 'succeeded' || result.success) {
        const donationAmount = Number(amount);
        completeSuccessfulPayment(donationAmount, `Donasi Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses setelah status berubah menjadi ${result.transactionStatus || 'succeeded'}`);
        return;
      }

      setPendingMessage('Pembayaran masih pending. Silakan selesaikan pembayaran di channel yang dipilih lalu cek lagi beberapa saat lagi.');
    } catch (err) {
      safeSetError(mapToPaymentErrorMessage(err, 'Gagal mengecek status pembayaran'));
    } finally {
      setCheckingStatus(false);
      // stop suppressing errors shortly after check completes
      setTimeout(() => {
        suppressErrorsRef.current = false;
      }, 200);
    }
  };

  const cancelPendingPayment = async () => {
    if (!donationId) {
      safeSetError('Data pembayaran belum lengkap.');
      return;
    }

    const confirmed = window.confirm('Batalkan pembayaran ini? Transaksi pending akan dihentikan.');
    if (!confirmed) {
      return;
    }

    setCheckingStatus(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/payments/cancel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ donationId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal membatalkan pembayaran');
      }

      removePendingPayment(donationId, orderId);
      setPendingMessage('Pembayaran berhasil dibatalkan.');
      setStep('error');
      safeSetError('Pembayaran telah dibatalkan.');
    } catch (err) {
      safeSetError(mapToPaymentErrorMessage(err, 'Gagal membatalkan pembayaran'));
    } finally {
      setCheckingStatus(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // donationId and transaction token will be created on-demand below

    setLoading(true);
    setError('');

    try {
      console.log('[Payment] Starting payment flow with method:', paymentMethod);

      let createdData: any = null;
      let tokenToUse = '';

      try {
        const createResp = await fetch(apiUrl('/api/payments/create-intent'), {
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

        if (!createResp.ok) {
          const body = await createResp.json().catch(() => ({}));
          throw new Error(body.error || 'Gagal membuat transaksi pembayaran');
        }

        const data = await createResp.json();
        createdData = data;
        tokenToUse = data.transactionToken || '';
        setDonationId(Number(data.donationId));
        setOrderId(data.orderId || '');
        setTransactionId(data.transactionId || '');
        setTransactionToken(tokenToUse);
        setIsDemoPaymentMode(Boolean(data.demoMode));
        console.log('[Payment] Created Midtrans transaction token for method', paymentMethod, 'token:', !!tokenToUse);
      } catch (err) {
        console.error('[Payment] Failed to create Midtrans transaction:', err);
        throw err;
      }

      const demoFlag = Boolean(createdData?.demoMode);

      if (!demoFlag) {
        if (!midtransClientKey) {
          throw new Error('VITE_MIDTRANS_CLIENT_KEY belum diisi di .env');
        }

        if (!isSnapReady || !window.snap) {
          throw new Error('Midtrans Snap belum siap. Tunggu beberapa detik lalu coba lagi.');
        }

        console.log('[Payment] Snap SDK is ready, window.snap:', typeof window.snap);
        console.log('[Payment] Calling window.snap.pay with token:', tokenToUse);
        setLoading(false);

        let snapCallbackFired = false;
        const snapTimeoutHandle = setTimeout(() => {
            if (!snapCallbackFired) {
            console.error('[Payment] TIMEOUT: Snap popup did not show or callback not fired after 10 seconds');
            safeSetError('Pembayaran tidak bisa dilanjutkan saat ini. Silakan coba lagi beberapa saat.');
          }
        }, 10000);

        try {
          const donationIdForCallback = createdData?.donationId ? Number(createdData.donationId) : donationId;
          const orderIdForCallback = createdData?.orderId || orderId;
          const transactionIdForCallback = createdData?.transactionId || transactionId;
          window.snap.pay(tokenToUse, {
            onSuccess: async (result: Record<string, unknown>) => {
              snapCallbackFired = true;
              paymentCompletionRef.current = true;
              clearTimeout(snapTimeoutHandle);
              console.info('Midtrans onSuccess', { result, donationId: donationIdForCallback, orderId: orderIdForCallback });
              try {
                const response = await fetch(apiUrl('/api/payments/confirm'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token') || ''}`
                  },
                  body: JSON.stringify({
                    donationId: donationIdForCallback,
                    orderId: orderIdForCallback,
                    transactionId: String(result.transaction_id || transactionIdForCallback || ''),
                    transactionStatus: String(result.transaction_status || '')
                  })
                });

                if (!response.ok) {
                  const body = await response.json().catch(() => ({}));
                  throw new Error(body.error || 'Konfirmasi pembayaran gagal');
                }

                const donationAmount = Number(amount);
                completeSuccessfulPayment(donationAmount, `Donasi Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses`);
              } catch (err) {
                console.error('Confirm failed after onSuccess', err);
                safeSetError(err instanceof Error ? err.message : 'Konfirmasi pembayaran gagal');
              }
            },
            onPending: (result: Record<string, unknown>) => {
              snapCallbackFired = true;
              paymentCompletionRef.current = true;
              clearTimeout(snapTimeoutHandle);
              console.info('Midtrans onPending', { result, donationId: donationIdForCallback, orderId: orderIdForCallback });

              // Simpan pending payment agar tetap bisa dilanjutkan dari halaman resume.
              const redirectUrlValue = String(result.redirect_url || result.url || '');
              console.info('Saving pending payment with redirectUrl:', { redirectUrlValue });
              const ownerEmail = String(user?.email || donorEmail || '').trim();
              
                const pendingPaymentData = {
                  donationId: Number(donationIdForCallback || 0),
                  orderId: String(orderIdForCallback || ''),
                  campaignTitle,
                  amount: Number(amount),
                  method: paymentMethod,
                  redirectUrl: redirectUrlValue,
                  transactionToken: tokenToUse,
                  ownerEmail: ownerEmail || undefined,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };
              
              console.info('Pending payment data:', pendingPaymentData);
              upsertPendingPayment(pendingPaymentData);
              setPendingDetails(result);
              setPendingMessage('Pembayaran Anda tercatat sebagai pending. Silakan selesaikan pembayaran di channel yang dipilih.');
              setStep('pending');
            },
            onError: (result?: Record<string, unknown>) => {
              snapCallbackFired = true;
              clearTimeout(snapTimeoutHandle);
              console.error('Midtrans onError', { result, donationId: donationIdForCallback, orderId: orderIdForCallback });
              safeSetError('Pembayaran Midtrans gagal. Silakan coba lagi.');
            },
            onClose: () => {
              snapCallbackFired = true;
              clearTimeout(snapTimeoutHandle);
              console.info('Midtrans onClose', { donationId: donationIdForCallback, orderId: orderIdForCallback, transactionId: transactionIdForCallback, step: stepRef.current });
              if (stepRef.current === 'payment' && !paymentCompletionRef.current) {
                console.info('Midtrans closed before callback completion; keeping current state until callback resolves');
              } else {
                console.info('Midtrans closed after success/pending — ignoring');
              }
            }
          });
          return;
        } catch (err) {
          console.error('[Payment] Error calling snap.pay:', err);
          const errorMessage = err instanceof Error ? err.message : String(err || 'Unknown error');
          const looksLikeSnapPostMessageIssue = /postMessage|origin|recipient window/i.test(errorMessage);

          if (!looksLikeSnapPostMessageIssue) {
            clearTimeout(snapTimeoutHandle);
            safeSetError(`Gagal membuka Snap: ${errorMessage}`);
          }
          return;
        }
      }

      const donationIdToUse = createdData?.donationId ? Number(createdData.donationId) : donationId;
      const orderIdToUse = createdData?.orderId ? (createdData.orderId || '') : orderId;
      const transactionIdToUse = createdData?.transactionId ? (createdData.transactionId || '') : transactionId;

      const response = await fetch(apiUrl('/api/payments/confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          donationId: donationIdToUse,
          orderId: orderIdToUse,
          transactionId: transactionIdToUse
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Konfirmasi pembayaran gagal');
      }

      const donationAmount = Number(amount);
      completeSuccessfulPayment(donationAmount, `Donasi Rp ${donationAmount.toLocaleString('id-ID')} berhasil diproses (metode: ${paymentMethod})`);
    } catch (err) {
      safeSetError(mapToPaymentErrorMessage(err, 'Pembayaran gagal'));
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nama Lengkap</label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pesan dan Doa (Opsional)</label>
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
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
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
                  <span className="text-xs text-slate-500 font-normal">
                    {` (Rp ${formatNumberWithSeparators(String(MIN_DONATION))} - Rp ${formatNumberWithSeparators(String(MAX_DONATION))})`}
                  </span>
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

              {/* Tips moved to Navbar */}

              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => {
                      if (e.target.checked && !user?.email) {
                        alert('Anda harus login terlebih dahulu untuk menggunakan fitur donasi rutin');
                        return;
                      }
                      setIsRecurring(e.target.checked);
                    }}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-600"
                  />
                  <div>
                    <div className="flex items-center gap-2 font-medium text-amber-800 mb-1">
                      <Calendar className="w-4 h-4" />
                      Jadikan Donasi Rutin
                    </div>
                    <p className="text-sm text-amber-700">
                      Donasi Anda akan otomatis dilakukan setiap bulan untuk membantu berkelanjutan
                      {!user?.email && <span className="block mt-1 text-red-700 font-medium">*Memerlukan akun login</span>}
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
                  disabled={!amount || Number(amount) < MIN_DONATION || Number(amount) > MAX_DONATION || loading}
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
                  <span className="font-semibold text-slate-900">Rp {Number(amount || 0).toLocaleString('id-ID')}</span>
                </div>
                {/* Tips moved to Navbar; show only donation amount here */}
                {isRecurring && (
                  <div className="text-sm text-amber-700 flex items-center gap-1 mt-2">
                    <Calendar className="w-4 h-4" />
                    Donasi Rutin Bulanan
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900 mb-4">Pilih Metode Pembayaran</h3>

                <div className="space-y-3">
                  <label className={`flex w-full items-center gap-4 rounded-xl border px-4 py-4 cursor-pointer transition-all ${paymentMethod === 'ewallet' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                    <input type="radio" name="method" value="ewallet" checked={paymentMethod === 'ewallet'} onChange={() => handlePaymentMethodChange('ewallet')} className="h-4 w-4 shrink-0 accent-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-slate-900">E-Wallet</div>
                      <div className="mt-0.5 text-sm text-slate-500">GoPay, ShopeePay</div>
                    </div>
                  </label>

                  <label className={`flex w-full items-center gap-4 rounded-xl border px-4 py-4 cursor-pointer transition-all ${paymentMethod === 'virtual_account' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                    <input type="radio" name="method" value="virtual_account" checked={paymentMethod === 'virtual_account'} onChange={() => handlePaymentMethodChange('virtual_account')} className="h-4 w-4 shrink-0 accent-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-slate-900">Virtual Account</div>
                      <div className="mt-0.5 text-sm text-slate-500">BCA, Mandiri, BNI, BRI</div>
                    </div>
                  </label>
                </div>
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
                  {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" />Bayar</>}
                </button>
              </div>
            </form>
          )}

          {step === 'pending' && (
            <div className="py-2 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
                  <Clock3 className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="font-semibold text-xl text-slate-900 mb-2">
                  Pembayaran Pending
                </h3>
                <p className="text-slate-600">
                  {pendingMessage || 'Pembayaran Anda tercatat sebagai pending. Silakan selesaikan pembayaran di channel yang dipilih.'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Order ID</span>
                  <span className="font-medium text-slate-900 text-right break-all">{orderId || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Metode</span>
                  <span className="font-medium text-slate-900">{paymentMethod === 'virtual_account' ? 'Virtual Account' : 'E-Wallet'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-amber-700">Menunggu pembayaran</span>
                </div>
              </div>

              {paymentMethod === 'virtual_account' && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-900">Langkah pembayaran VA</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                    <li>Buka m-banking, internet banking, atau ATM.</li>
                    <li>Pilih menu transfer ke Virtual Account.</li>
                    <li>Masukkan nomor VA yang ditampilkan di aplikasi Midtrans.</li>
                    <li>Selesaikan pembayaran sebelum batas waktu habis.</li>
                  </ol>
                </div>
              )}

              {paymentMethod === 'ewallet' && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-900">Langkah pembayaran E-Wallet</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
                    <li>Buka aplikasi e-wallet yang dipilih.</li>
                    <li>Lanjutkan pembayaran dari notifikasi atau halaman yang terbuka.</li>
                    <li>Konfirmasi pembayaran sampai status berubah menjadi sukses.</li>
                  </ol>
                  {(pendingDetails?.redirect_url || pendingDetails?.url) && (
                    <a
                      href={String(pendingDetails.redirect_url || pendingDetails.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                    >
                      Buka halaman pembayaran
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {pendingDetails?.va_numbers && Array.isArray(pendingDetails.va_numbers) && pendingDetails.va_numbers.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <h4 className="font-semibold text-slate-900">Nomor Virtual Account</h4>
                  <div className="space-y-2">
                    {pendingDetails.va_numbers.map((item, index) => (
                      <div key={`${String(item?.bank || 'bank')}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-700">{String(item?.bank || 'Bank').toUpperCase()}</span>
                        <span className="font-semibold text-slate-900 break-all">{String(item?.va_number || '-')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToContinuePayment?.({
                    donationId: donationId || 0,
                    orderId: orderId || '',
                    campaignTitle: campaignTitle || '',
                    amount: Number(amount || 0),
                    method: paymentMethod,
                    redirectUrl: pendingDetails?.redirect_url ? String(pendingDetails.redirect_url) : pendingDetails?.url ? String(pendingDetails.url) : undefined
                  });
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <ExternalLink className="h-4 w-4" />
                Buka Halaman Lanjutkan Pembayaran
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Tutup
                </button>
                <button
                  onClick={checkPendingStatus}
                  disabled={checkingStatus}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {checkingStatus ? <Loader className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4" />Cek Status</>}
                </button>
              </div>

              <button
                onClick={cancelPendingPayment}
                disabled={checkingStatus}
                className="w-full py-3 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
              >
                Batalkan Pembayaran
              </button>
            </div>
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
              <button
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Tutup
              </button>
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
