import { Heart, Calendar, TrendingUp } from 'lucide-react';

interface DonasiSayaProps {
  user: { name: string; email?: string } | null;
  onLogin: () => void;
  donations?: Array<{
    id: number;
    campaignTitle: string;
    amount: number;
    date: string;
    status: 'Sukses' | 'Dalam Proses';
    campaignId: number;
  }>;
}

export function DonasiSaya({ user, onLogin, donations = [] }: DonasiSayaProps) {
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Heart className="mx-auto text-blue-600 mb-4" size={48} />
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Donasi Saya</h1>
          <p className="text-gray-600 mb-6">
            Riwayat donasi hanya tampil setelah Anda masuk ke akun.
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Masuk terlebih dahulu
          </button>
        </div>
      </div>
    );
  }

  const totalDonated = donations.reduce((sum, d) => sum + d.amount, 0);
  const successfulDonations = donations.filter(d => d.status === 'Sukses').length;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Donasi Saya</h1>
          <p className="text-gray-600">Kelola dan pantau semua donasi Anda di sini</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Donasi</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  Rp {(totalDonated / 1000000).toFixed(1)}M
                </p>
              </div>
              <Heart className="text-red-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Donasi Berhasil</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {successfulDonations}
                </p>
              </div>
              <TrendingUp className="text-green-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Donasi Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {donations.length}
                </p>
              </div>
              <Calendar className="text-blue-500" size={32} />
            </div>
          </div>
        </div>

        {/* Donations List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Riwayat Donasi</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {donations.length > 0 ? (
              donations.map((donation) => (
                <div key={donation.id} className="px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900">{donation.campaignTitle}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        donation.status === 'Sukses'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {donation.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{donation.date}</span>
                    <span className="text-lg font-bold text-blue-600">
                      Rp {donation.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <Heart className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">Belum ada donasi. Mulai donasi sekarang!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
