import { useState } from 'react';
import { Upload } from 'lucide-react';

interface CreateCampaignProps {
  onCreate: (campaign: any) => void;
  user?: { name: string; email?: string } | null;
}

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

const quickTargetOptionsLeft = [2000000, 5000000, 10000000];
const quickTargetOptionsRight = [25000000, 50000000];

const formatCurrency = (value: string) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return 'Rp 0';
  }

  return `Rp ${numericValue.toLocaleString('id-ID')}`;
};

const formatNumberWithSeparators = (value: string) => {
  if (!value) {
    return '';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString('id-ID') : value;
};

export function CreateCampaign({ onCreate, user }: CreateCampaignProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'UMKM Terdampak Bencana',
    target: '',
    location: '',
    fullDescription: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const showError = (message: string) => {
    setError(message);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleImageChange = (file: File | null) => {
    setSelectedImage(file);

    if (!file) {
      setImagePreview('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTargetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.replace(/[^\d]/g, '');
    setFormData((prev) => ({
      ...prev,
      target: rawValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) {
        showError('Silakan login atau daftar terlebih dahulu untuk membuat kampanye');
        setLoading(false);
        return;
      }

      if (!formData.title || !formData.description || !formData.target || !formData.location) {
        showError('Semua field harus diisi');
        setLoading(false);
        return;
      }

      const targetAmount = parseInt(formData.target);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        showError('Target dana harus berupa angka positif');
        setLoading(false);
        return;
      }

      // Create campaign object
      const newCampaign = {
        id: Math.floor(Math.random() * 10000),
        createdAt: Date.now(),
        title: formData.title,
        description: formData.description,
        fullDescription: formData.fullDescription || formData.description,
        image: imagePreview || 'https://images.unsplash.com/photo-1767678384957-7ba885ab06d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxzbWFsbCUyMGJ1c2luZXNzJTIwc2hvcCUyMGluZG9uZXNpYXxlbnwxfHx8fDE3Nzc1MzI5MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
        location: formData.location,
        creatorEmail: user.email,
        target: targetAmount,
        collected: 0,
        donors: 0,
        daysLeft: 30,
        category: formData.category,
        organizer: user.name,
        status: 'pending',
        story: formData.fullDescription || formData.description,
        fundAllocation: [
          { name: 'Alokasi Dana', value: targetAmount, color: '#10B981' }
        ],
        disbursementHistory: []
      };

      // In a real app, you'd send this to the backend
      // For now, just create it locally
      onCreate(newCampaign);

      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'UMKM Terdampak Bencana',
        target: '',
        location: '',
        fullDescription: ''
      });
      setSelectedImage(null);

      alert('Kampanye berhasil dibuat!');
    } catch (err) {
      showError('Terjadi kesalahan saat membuat kampanye');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {!user && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          Anda belum punya akun. Silakan daftar atau masuk dulu sebelum mengirim kampanye.
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Judul Kampanye
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nama kampanye"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deskripsi Singkat
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Deskripsi singkat kampanye"
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cerita Lengkap
        </label>
        <textarea
          name="fullDescription"
          value={formData.fullDescription}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Cerita lengkap tentang kampanye dan mengapa membutuhkan bantuan"
          rows={5}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kategori
        </label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>UMKM Terdampak Bencana</option>
          <option>Kesehatan</option>
          <option>Pendidikan</option>
          <option>Kemanusiaan</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Dana (Rp)
          </label>
          <input
            type="text"
            name="target"
            value={formatNumberWithSeparators(formData.target)}
            onChange={handleTargetChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="10000000"
            inputMode="numeric"
            required
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              {quickTargetOptionsLeft.map((amountOption) => (
                <button
                  key={amountOption}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, target: String(amountOption) }))}
                  className="px-3 py-1 rounded-full border border-blue-200 text-blue-700 text-xs hover:bg-blue-50"
                >
                  {formatCurrency(String(amountOption))}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {quickTargetOptionsRight.map((amountOption) => (
                <button
                  key={amountOption}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, target: String(amountOption) }))}
                  className="px-3 py-1 rounded-full border border-blue-200 text-blue-700 text-xs hover:bg-blue-50"
                >
                  {formatCurrency(String(amountOption))}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lokasi
          </label>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            required
          >
            <option value="" disabled>Pilih lokasi</option>
            {locationOptions.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <label htmlFor="campaign-image" className="cursor-pointer block text-center">
          <input
            id="campaign-image"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
          />
          {imagePreview ? (
            <div className="space-y-3">
              <img
                src={imagePreview}
                alt="Pratinjau foto kampanye"
                className="mx-auto h-40 w-full max-w-sm rounded-lg object-cover"
              />
              <p className="text-sm text-gray-700 font-medium">{selectedImage?.name}</p>
              <p className="text-xs text-gray-500">Klik lagi untuk mengganti foto</p>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-600">Klik untuk upload foto kampanye (opsional)</p>
            </div>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
      >
        {loading ? 'Membuat Kampanye...' : 'Buat Kampanye'}
      </button>
    </form>
  );
}
