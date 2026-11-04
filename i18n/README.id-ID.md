# MiawRouter

[English](../README.md) · Bahasa Indonesia

MiawRouter adalah gateway AI lokal yang menyediakan endpoint kompatibel OpenAI dan meneruskan permintaan ke provider yang dikonfigurasi. Dukungan model, kuota, dan ketersediaan bergantung pada provider dan akun; layanan gratis tidak dijamin tanpa batas.

Source ini menargetkan **1.2.5**. Versi yang tersedia di npm dapat berbeda. Baca [catatan audit 1.2.5](../docs/release-1.2.5-audit.md) untuk hasil pengujian dan pekerjaan yang masih terbuka.

## Instalasi

Pasang Node.js 20.18.1 atau lebih baru, lalu jalankan:

```powershell
npm install -g miawrouter@latest
miawrouter
```

Dashboard CLI tersedia di `http://127.0.0.1:21128/dashboard`. Pada Windows, data secara default berada di `%APPDATA%\miawrouter`; pada macOS/Linux di `~/.miawrouter`. Variabel `DATA_DIR` dapat mengubah lokasinya.

CLI 1.2.5 mendengarkan hanya pada komputer lokal secara default. Untuk akses dari jaringan, gunakan `miawrouter --host 0.0.0.0` dan atur autentikasi serta pembatasan jaringan. Jika port sudah digunakan, CLI akan melaporkannya tanpa menghentikan proses lain.

## Menjalankan dari source

```powershell
git clone https://github.com/skutanjir/miawrouter.git
cd miawrouter
npm install
npm --prefix tests install
npm run dev
```

Mode development menggunakan `http://127.0.0.1:21127`. Untuk build produksi gunakan `npm run build` lalu `npm run start`; server produksi memakai port 21128.

## Penggunaan pertama

1. Buka dashboard dari komputer yang menjalankan MiawRouter dan buat kata sandi bila diminta.
2. Buka **Endpoint** dan salin API key MiawRouter.
3. Buka **Providers** untuk menghubungkan akun atau API key provider yang Anda miliki.
4. Atur aplikasi klien ke `http://127.0.0.1:21128/v1`, lalu pilih model atau combo yang tersedia.

Jangan kirim API key, token OAuth, atau kata sandi ke chat. Model yang muncul di `/v1/models` berasal dari konfigurasi dan katalog; tampilnya model tidak menjamin akun Anda dapat menggunakannya saat itu.

## Routing dan cache

Combo menyediakan fallback berurutan dan pilihan round-robin. Request tidak valid atau dibatalkan tidak diteruskan secara sembarangan ke akun lain. Capacity adapter dapat menggunakan model alternatif yang dikonfigurasi untuk input tertentu, tetapi metadata kemampuan model dapat belum lengkap; periksa dukungan gambar atau audio pada model yang dipilih.

Cache respons L1 hanya mempertimbangkan request non-streaming tanpa tool dengan temperatur nol. Cache semantik L2 bersifat opsional dan mati secara default. Untuk melewati cache pada sebuah request, gunakan header `X-Miaw-Bypass: cache`. Temperatur nol tidak menjamin keluaran provider selalu identik.

## MITM dan privasi

MITM dapat mendekripsi trafik IDE yang diarahkan melaluinya. Aktifkan hanya pada perangkat yang Anda kendalikan; kelola dan hapus root CA melalui fitur MITM jika tidak diperlukan. Capture mentah Cursor tidak aktif secara default. Dump MITM development juga hanya aktif bila `NODE_ENV=development` dan `MITM_DEBUG_CAPTURE=1`. Isi capture dan log dapat memuat prompt, kode, serta data sensitif.

API key dan token provider disimpan di database lokal. Lindungi direktori data dan cadangannya. Pada Windows, perlindungan file bergantung pada ACL; mode Unix `0600` tidak membuktikan ACL Windows sudah aman. Detailnya ada di [SECURITY.md](../SECURITY.md).

OpenCode Free Bridge tidak lagi dimulai otomatis. Konfigurasi provider yang sudah ada tetap disimpan. Gunakan cara akses yang didukung provider dan perhatikan batasan layanannya.

## Pengujian dan dokumentasi

```powershell
npm run test:ci
npm run lint
npm run build
```

Tes offline tidak membuktikan provider atau kredensial asli berfungsi. Lihat [README utama](../README.md), [changelog](../CHANGELOG.md), [kebijakan keamanan](../SECURITY.md), dan [catatan audit](../docs/release-1.2.5-audit.md) untuk batas pengujian dan pekerjaan tersisa.

MiawRouter menggunakan [lisensi MIT](../LICENSE); pemberitahuan lisensi pihak ketiga tersedia di [cli/THIRD_PARTY_NOTICES.md](../cli/THIRD_PARTY_NOTICES.md).
