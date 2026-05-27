# 3. Implementasi: Screenshot Fitur Utama dan Penjelasan Teknis Integrasi API/AI

## 3.1 Ringkasan Implementasi Sistem

Platform **BantuSesama** diimplementasikan sebagai aplikasi web full-stack untuk micro-crowdfunding sosial dengan komponen:

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (melalui Sequelize ORM)
- **Integrasi API utama**: Midtrans (Payment Gateway)
- **Integrasi AI sederhana**: Chatbot berbasis Knowledge Base + Gemini (fallback-aware)

Arsitektur ini memungkinkan proses donasi end-to-end, monitoring status pembayaran, donasi rutin, dan transparansi informasi kampanye.

## 3.2 Daftar Screenshot Fitur Utama (Wajib Lampirkan)

Simpan seluruh screenshot pada folder `docs/uas/screenshots/` sesuai nama file pada tabel berikut.

| No | Nama File Screenshot | Fitur | Bukti yang Harus Terlihat |
|---|---|---|---|
| 1 | `01-home-page.png` | Beranda kampanye | Daftar kampanye, CTA donasi |
| 2 | `02-campaign-detail.png` | Detail kampanye | Story, target, progres dana |
| 3 | `03-transparency-tab.png` | Transparansi dana publik | Grafik alokasi dana + riwayat pencairan |
| 4 | `04-payment-modal-identity.png` | Modal donasi step identitas | Input nama, email, anonim |
| 5 | `05-payment-modal-amount.png` | Modal donasi step nominal | Nominal donasi dan opsi donasi rutin |
| 6 | `06-midtrans-checkout.png` | Integrasi Midtrans | Snap/payment page terbuka |
| 7 | `07-payment-success-or-pending.png` | Hasil pembayaran | Status sukses/pending + order info |
| 8 | `08-donasi-saya-history.png` | Riwayat donasi | Daftar donasi dengan urutan terbaru di atas |
| 9 | `09-admin-dashboard.png` | Dashboard admin | Verifikasi kampanye / monitoring |
| 10 | `10-chatbot-feature.png` | Fitur AI chatbot | Percakapan user dan respons bot |
| 11 | `11-recurring-setup.png` | Donasi rutin | Setup monthly/yearly berhasil |
| 12 | `12-recurring-management.png` | Manajemen donasi rutin | List/detail/cancel recurring donation |

Catatan: Jika dosen meminta minimal screenshot, gunakan 1-10. Jika diminta bukti fitur wajib lengkap, gunakan semua 1-12.

## 3.2.1 Penjelasan Lengkap Setiap Screenshot

### 1. `01-home-page.png` - Beranda Kampanye
Screenshot ini menunjukkan halaman utama aplikasi yang berisi daftar kampanye sosial aktif. Di bagian ini, pengguna dapat melihat ringkasan setiap kampanye, seperti judul, lokasi, target dana, dana terkumpul, dan tombol untuk masuk ke detail kampanye atau mulai berdonasi. Tampilan ini menjadi pintu masuk utama bagi donatur untuk memilih kampanye yang ingin dibantu.

### 2. `02-campaign-detail.png` - Detail Kampanye
Gambar ini menampilkan halaman detail salah satu kampanye. Di dalamnya terdapat informasi lengkap seperti cerita kampanye, kebutuhan dana, progres penggalangan, profil penggalang dana, serta tombol donasi. Halaman ini penting karena menjadi tempat pengguna mengevaluasi kredibilitas dan urgensi kampanye sebelum melakukan donasi.

### 3. `03-transparency-tab.png` - Transparansi Dana Publik
Screenshot ini memperlihatkan tab transparansi yang berfungsi sebagai laporan publik aliran dana. Komponen yang tampil biasanya berupa grafik alokasi dana, riwayat pencairan, dan rincian penggunaan dana. Fitur ini mendukung nilai utama platform, yaitu kepercayaan dan akuntabilitas, karena publik dapat memantau dana yang masuk dan keluar.

### 4. `04-payment-modal-identity.png` - Modal Donasi Step Identitas
Bagian ini menunjukkan tahap awal formulir donasi, yaitu pengisian identitas donatur. Pengguna mengisi nama, email, dan dapat memilih donasi anonim. Tahap ini diperlukan untuk menyimpan data donatur, mengirim notifikasi pembayaran, dan mencatat riwayat donasi secara konsisten.

### 5. `05-payment-modal-amount.png` - Modal Donasi Step Nominal
Screenshot ini memperlihatkan tahap pemilihan nominal donasi. Pengguna dapat memasukkan nominal manual atau memilih nominal cepat, serta mengaktifkan opsi donasi rutin. Tahap ini menjadi inti transaksi karena menentukan nilai donasi yang akan diproses melalui payment gateway.

### 6. `06-midtrans-checkout.png` - Integrasi Midtrans
Gambar ini adalah bukti integrasi payment gateway Midtrans. Setelah pengguna menekan tombol bayar, sistem mengirim request ke backend untuk membuat transaksi, lalu membuka Midtrans Snap atau halaman pembayaran sesuai metode yang dipilih. Screenshot ini menjadi bukti bahwa aplikasi sudah menggunakan API pihak ketiga untuk proses pembayaran digital.

### 7. `07-payment-success-or-pending.png` - Hasil Pembayaran
Screenshot ini menunjukkan hasil akhir pembayaran, baik dalam status sukses maupun pending. Jika berhasil, data donasi akan tercatat di database dan nilai campaign bertambah. Jika pending, pengguna masih bisa melanjutkan pembayaran atau mengecek status transaksi. Ini penting untuk menunjukkan bahwa sistem menangani lifecycle pembayaran secara benar.

### 8. `08-donasi-saya-history.png` - Riwayat Donasi
Bagian ini menampilkan halaman Donasi Saya yang berisi daftar riwayat donasi milik pengguna. Riwayat ditampilkan dengan urutan terbaru di atas agar mudah dipantau. Fitur ini membantu pengguna melihat total dukungan yang pernah diberikan dan menjadi bukti bahwa transaksi berhasil disimpan ke sistem.

### 9. `09-admin-dashboard.png` - Dashboard Admin
Screenshot ini menampilkan panel admin yang digunakan untuk verifikasi kampanye, monitoring data pengguna, dan pengecekan aktivitas sistem. Dashboard ini penting untuk memastikan kampanye yang tampil ke publik sudah diverifikasi dan untuk menjaga kualitas data di platform.

### 10. `10-chatbot-feature.png` - Fitur AI Chatbot
Gambar ini menunjukkan chatbot yang membantu menjawab pertanyaan pengguna. Chatbot dapat merespons pertanyaan umum seperti cara donasi, metode pembayaran, dan transparansi dana. Secara teknis, fitur ini memakai knowledge base dan bisa diperluas menggunakan Gemini sebagai AI tambahan.

### 11. `11-recurring-setup.png` - Donasi Rutin
Screenshot ini menampilkan proses aktivasi donasi rutin. Pengguna memilih donasi bulanan atau tahunan dan sistem menyimpan data recurring donation untuk diproses secara berkala. Fitur ini penting karena mendukung donatur tetap yang ingin membantu kampanye secara otomatis dan berkelanjutan.

### 12. `12-recurring-management.png` - Manajemen Donasi Rutin
Gambar ini memperlihatkan halaman pengelolaan donasi rutin, seperti melihat daftar recurring donation, melihat detailnya, atau membatalkan langganan donasi. Fitur ini menunjukkan bahwa sistem tidak hanya menerima donasi sekali bayar, tetapi juga menyediakan kontrol penuh bagi donatur rutin.

## 3.3 Penjelasan Teknis Integrasi API (Payment Gateway)

### A. API Midtrans untuk Pembayaran Donasi

Integrasi payment gateway dilakukan melalui endpoint backend berikut:

- `POST /api/payments/create-intent`
- `POST /api/payments/confirm`
- `GET /api/payments/status/:orderId`
- `POST /api/payments/cancel`
- `POST /api/payments/webhook`

#### Alur teknis ringkas

1. Frontend mengirim data donasi ke `create-intent`.
2. Backend membuat record donasi (`paymentStatus: pending`) dan meminta token transaksi Midtrans.
3. Frontend membuka Midtrans Snap menggunakan token.
4. Setelah callback (success/pending), frontend mengirim konfirmasi ke `confirm`.
5. Backend memverifikasi status transaksi dan memperbarui `paymentStatus` menjadi `succeeded`/`processing`/`failed`.
6. Jika sukses, nilai `campaign.collected` ditambahkan otomatis.
7. Endpoint webhook tetap menerima notifikasi asinkron dari Midtrans untuk konsistensi data.

### B. API Donasi Rutin (Recurring Donations)

Untuk donatur tetap, sistem menyediakan endpoint:

- `POST /api/recurring/setup`
- `GET /api/recurring/list`
- `GET /api/recurring/details/:recurringDonationId`
- `POST /api/recurring/cancel/:recurringDonationId`
- `PUT /api/recurring/update/:recurringDonationId`
- `POST /api/recurring/process-now` (trigger manual/testing)

#### Mekanisme recurring

- Donasi induk disimpan dengan `recurringType` (`monthly`/`yearly`).
- Scheduler/service memeriksa donasi yang jatuh tempo.
- Saat jatuh tempo, sistem membuat child donation baru sebagai jejak charge periodik.
- Riwayat charge dapat ditelusuri dari relasi parent-child pada tabel donasi.

## 3.4 Penjelasan Teknis Integrasi AI (Chatbot)

Fitur AI chatbot menggabungkan dua mode respons:

1. **Knowledge Base rule-based** untuk pertanyaan umum (cara donasi, transparansi, keamanan, dsb).
2. **Gemini NLP mode** (`/api/chatbot/nlp`) untuk respons dinamis saat API key tersedia.

### Strategi reliabilitas AI

- Fallback otomatis ke Knowledge Base saat Gemini tidak tersedia.
- Rate limiting lokal (token bucket) untuk mencegah over-request.
- Retry dengan backoff untuk error sementara pada provider AI.
- Logging interaksi chatbot ke database untuk evaluasi kualitas jawaban.

## 3.5 Aspek Keamanan Implementasi (Singkat)

- Password di-hash menggunakan bcrypt.
- Route sensitif menggunakan middleware JWT (`auth`/`optionalAuth`).
- Verifikasi status pembayaran dilakukan server-side.
- Deployment production wajib menggunakan HTTPS agar memenuhi standar keamanan UAS.

## 3.6 Ringkasan Nilai Implementasi terhadap Tema

Implementasi ini mendukung tema **Micro-Crowdfunding Sosial** melalui:

- Transparansi data kampanye dan progress dana.
- Pembayaran digital terintegrasi (VA/E-wallet) via Midtrans.
- Donasi rutin untuk keberlanjutan pendanaan UMKM terdampak bencana.
- Dukungan AI chatbot untuk meningkatkan akses informasi pengguna.
