# Riwayat Dosen PNL

Aplikasi ini memakai HTML/CSS/JavaScript dan API berbasis Node.js. Tidak memerlukan PHP atau database.

## Jalankan lokal

Pastikan fitur Node.js Laragon terpasang. Klik dua kali file `Jalankan-Lokal.bat` di folder proyek. File ini memakai Node.js dari instalasi Laragon, membuka aplikasi di browser, dan menjalankan API Node.js di jendela kecil. Biarkan jendela API tetap berjalan saat memakai aplikasi. Alamat aplikasi adalah `http://localhost:3000`, bukan alamat Laragon seperti `localhost/riwayat-dosen/riwayat-dosen/`.

## Deploy ke Vercel

1. Push folder proyek ini ke repository Git.
2. Import repository tersebut di Vercel.
3. Biarkan Vercel mendeteksi proyek statis dan fungsi Node.js di folder `api/`.
4. Deploy.

`index.html` menjadi halaman utama. File di folder `api/` menjadi endpoint serverless di Vercel. Server lokal hanya berada di `local/server.js` agar tidak ikut terdeteksi Vercel sebagai fungsi. Endpoint riwayat dosen mengakses PDDikti; hasil ekspor disimpan di cache browser untuk mempercepat unduhan berikutnya.

Unduhan dibuat dalam CSV UTF-8 yang bisa dibuka dengan Microsoft Excel. Akses PDDikti dapat dibatasi oleh layanan upstream; kolom status pada hasil ekspor menunjukkan dosen yang riwayatnya tidak berhasil dimuat.

## File rekap pendidikan

Untuk memakai data pendidikan cadangan, unggah file Excel hasil unduhan aplikasi ke folder utama repository dengan nama yang diawali `rekap-pendidikan-dosen-pnl` dan berakhiran `.xls` (contoh: `rekap-pendidikan-dosen-pnl-2026-10-17.xls`). File harus berisi kolom `Nama Dosen`, `NIDN`, `S1 - Kampus`, `S1 - Tahun Lulus`, `S2 - Kampus`, `S2 - Tahun Lulus`, `S3 - Kampus`, dan `S3 - Tahun Lulus`. Fungsi Vercel mengambil file itu untuk halaman riwayat dan unduhan rekap. Pencarian ID dosen dan riwayat dari PDDikti tetap digunakan ketika layanannya memberikan data; file rekap menjadi sumber cadangan.

Setelah file dan perubahan program diunggah ke GitHub, tunggu deployment Vercel berstatus **Ready**, lalu buka kembali situs dan coba cari dosen dengan NIDN.
