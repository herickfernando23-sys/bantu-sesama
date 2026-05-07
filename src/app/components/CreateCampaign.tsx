import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Toaster, toast } from 'sonner';

const apiBaseUrl = String(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

// Default image placeholder
const DEFAULT_CAMPAIGN_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 400%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22400%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2240%22 font-weight=%22bold%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239ca3af%22 font-family=%22Arial%22%3ENo Image%3C/text%3E%3C/svg%3E';

// Compress image function
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimensions
        const maxWidth = 800;
        const maxHeight = 600;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with quality 0.7
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        reject(new Error('Gagal memproses gambar'));
      };
    };
    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar'));
    };
  });
};

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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar terlalu besar. Maksimal 5MB.');
      setSelectedImage(null);
      setImagePreview('');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau GIF.');
      setSelectedImage(null);
      setImagePreview('');
      return;
    }

    // Compress and preview
    compressImage(file)
      .then((compressedDataUrl) => {
        setImagePreview(compressedDataUrl);
        toast.success('Gambar berhasil dikompres dan siap diunggah');
      })
      .catch((err) => {
        toast.error('Gagal memproses gambar. Silakan coba gambar lain.');
        console.error(err);
        setSelectedImage(null);
        setImagePreview('');
      });
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
        toast.error('Silakan login atau daftar terlebih dahulu untuk membuat kampanye');
        setLoading(false);
        return;
      }

      // Validate all required fields
      if (!formData.title.trim()) {
        toast.error('Judul kampanye tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (!formData.description.trim()) {
        toast.error('Deskripsi singkat tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (!formData.location) {
        toast.error('Lokasi tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (!formData.target) {
        toast.error('Target dana tidak boleh kosong');
        setLoading(false);
        return;
      }

      const targetAmount = parseInt(formData.target);
      if (isNaN(targetAmount) || targetAmount <= 0) {
        toast.error('Target dana harus berupa angka positif');
        setLoading(false);
        return;
      }

      if (targetAmount < 100000) {
        toast.error('Target dana minimal Rp 100.000');
        setLoading(false);
        return;
      }

      // Use default image if no image provided
      const campaignImage = imagePreview || DEFAULT_CAMPAIGN_IMAGE;

      const response = await fetch(`${apiBaseUrl}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          goal: targetAmount,
          creatorEmail: user.email,
          organizer: user.name,
          location: formData.location,
          category: formData.category,
          image: campaignImage,
          status: 'pending',
          daysLeft: 30,
          fullDescription: formData.fullDescription || formData.description
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorMsg = body.error || 'Gagal membuat kampanye. Silakan coba lagi.';
        throw new Error(errorMsg);
      }

      const createdCampaign = await response.json();
      const newCampaign = {
        id: createdCampaign.id,
        createdAt: Date.now(),
        title: createdCampaign.title,
        description: createdCampaign.description,
        fullDescription: createdCampaign.fullDescription || formData.fullDescription || formData.description,
        image: createdCampaign.image || campaignImage || DEFAULT_CAMPAIGN_IMAGE,
        location: createdCampaign.location || formData.location,
        creatorEmail: createdCampaign.creatorEmail || user.email,
        target: targetAmount,
        collected: Number(createdCampaign.collected || 0),
        donors: 0,
        daysLeft: Number(createdCampaign.daysLeft || 30),
        category: createdCampaign.category || formData.category,
        organizer: createdCampaign.organizer || user.name,
        status: createdCampaign.status || 'pending',
        story: createdCampaign.fullDescription || formData.fullDescription || formData.description,
        fundAllocation: [
          { name: 'Alokasi Dana', value: targetAmount, color: '#10B981' }
        ],
        disbursementHistory: []
      };

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
      setImagePreview('');

      toast.success('Kampanye berhasil dibuat dan menunggu verifikasi admin');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat kampanye (upload gambar). Silakan coba lagi atau gunakan gambar dengan ukuran lebih kecil.';
      toast.error(errorMessage);
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
      <Toaster position="top-center" richColors />
    </form>
  );
}
