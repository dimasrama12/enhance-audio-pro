# Product Requirements Document (PRD) - Pembaruan Fitur Enhance Audio Pro

Dokumen ini merangkum catatan pembaruan dan perbaikan fungsionalitas yang perlu diimplementasikan pada aplikasi.

## 1. Perbaikan Tema Terang (Light Mode)
- **Visibilitas Elemen UI:** Memastikan semua teks, daftar antrean file (queue), dan elemen pada menu pengaturan dapat terlihat dengan jelas (kontras yang tepat) saat mode terang diaktifkan.
- **Perbaikan Bug Visibilitas Toolbar:** Memperbaiki masalah pada mode terang di mana kotak pencarian (Search files), *dropdown filter* file, *dropdown convert to*, dan tombol "Record" tidak terlihat. Pastikan elemen-elemen tersebut memiliki warna yang cukup kontras dengan latar belakang agar terlihat jelas.
- **Cakupan Tema Menyeluruh:** Penerapan mode terang harus mengubah tema dari keseluruhan antarmuka aplikasi secara konsisten, bukan hanya pada bagian tertentu.

## 2. Penyimpanan Konfigurasi Pengaturan (Settings Persistence) & Perubahan Global
- **Penyimpanan Konfigurasi Otomatis:** Seluruh perubahan pengaturan yang dilakukan oleh pengguna (seperti pemilihan tema, direktori output default, dll.) harus disimpan secara persisten. Saat pengguna membuka kembali aplikasi, konfigurasi terakhir yang dipilih akan langsung diterapkan. Hal ini berlaku untuk seluruh fitur yang dapat diatur di menu pengaturan.
- **Penerapan Bahasa Global:** Fitur pengubahan bahasa (Language) harus diterapkan secara menyeluruh ke seluruh bagian aplikasi (General, Format, tampilan awal, dll). Termasuk juga menerjemahkan teks "Processed Files History" dan deskripsinya, serta teks pada area *dropzone* (misalnya: "Drop audio here").
- **Integrasi Model AI DeepFilterNet:** Model AI DeepFilterNet untuk penghapusan noise (noise removal) harus ditanamkan (embedded/bundled) secara langsung ke dalam aplikasi. Tombol unduhan model AI pada menu pengaturan harus dihapus, sehingga pengguna dapat langsung menggunakannya.

## 3. Perubahan Tampilan & Fungsi Menu Pengaturan
- **Format User Guide:** Mengubah struktur tampilan Panduan Pengguna (User Guide) menjadi sangat ringkas (compact), yaitu digabungkan menjadi satu paragraf teks utuh di bawah bagian "Getting Started", tidak lagi menggunakan format kolom atau akordeon terpisah.
- **Sembunyikan Scrollbar:** Menghilangkan tampilan bilah gulir (scrollbar) pada menu pengaturan (baik di tab General maupun User Guide). Namun, area tersebut harus tetap dapat di-scroll dengan *mouse wheel* atau *trackpad*.
- **Lokalisasi User Guide:** Saat bahasa aplikasi diubah (misal ke Bahasa Indonesia), isi teks pada Panduan Pengguna juga harus ikut diterjemahkan dengan benar.

## 4. Pencegahan Interaksi & Scroll Latar Belakang
- **Penguncian Halaman Utama:** Saat pengguna membuka jendela/modal "Settings", sistem harus mencegah interaksi pengguna dengan halaman utama. Pengguna tidak diperbolehkan mengklik elemen di halaman utama.
- **Mencegah Window Scroll:** Mencegah keseluruhan jendela aplikasi (window) agar tidak ikut ter-scroll ke bawah. Kemampuan *scroll* hanya boleh diterapkan secara eksklusif pada kontainer daftar antrean file (queue container) atau panel riwayat, sehingga antarmuka aplikasi secara keseluruhan tetap pada posisinya.

## 5. Penyempurnaan Antarmuka Tabel Halaman Utama (Main Screen Table UI)
- **Tata Letak Header Tabel:** Memperbaiki tampilan teks pada header kolom tabel di halaman utama. Teks (seperti "SAMPLE HZ") tidak boleh terpotong menjadi dua baris.
- **Kolom yang Dapat Diubah Ukurannya (Resizable Columns):** Pengguna harus dapat mengatur/menarik lebar kolom khusus untuk "FILENAME" dan "DESTINATION" sesuai dengan preferensi mereka.
- **Pengaturan Lokasi Penyimpanan Individual (Clickable Destination):** Kolom "DESTINATION" pada setiap baris file audio harus dapat diklik untuk menentukan direktori penyimpanan spesifik.
- **Pengaturan Lokasi Penyimpanan Multi-Seleksi (Batch Destination Selection):** Jika pengguna menyeleksi beberapa file sekaligus lalu mengklik dan mengubah destinasi pada *salah satu* file yang diseleksi, maka destinasi seluruh file lain yang sedang diseleksi akan otomatis diperbarui.

## 6. Penyesuaian Teks & Interaksi Area Drop (Dropzone)
- **Teks Dinamis:** Mengubah teks pada area *dropzone* secara dinamis. Pada tab Audio, teks harus berbunyi "Drop audio files here", dan pada tab Video, teks berubah menjadi "Drop video files here". Teks ini juga harus berubah mengikuti bahasa aplikasi.
- **Klik untuk Membuka File Explorer:** Area *dropzone* tidak hanya berfungsi untuk *drag-and-drop*, tetapi juga dapat diklik untuk langsung membuka jendela File Explorer.

## 7. Tampilan Grid (Grid View) & Jalan Pintas (Shortcuts)
- **Tampilan Grid:** Mengubah mode *Grid View* (Tampilan Grid) untuk antrean file, di mana satu baris akan memuat tepat 3 kotak file secara berdampingan.
- **Shortcut Tampilan:** Menambahkan *shortcut* keyboard: tekan tombol `1` untuk beralih ke *Table View* (Tampilan Tabel) dan tombol `2` untuk beralih ke *Grid View* (Tampilan Grid). Info shortcut baru ini harus ditambahkan secara otomatis pada menu Shortcuts di pengaturan.

## 8. Pembatalan Seleksi (Deselect) File Antrean
- **Klik di Luar Area:** Selain menggunakan *shortcut* tombol `X` untuk membatalkan seleksi pada antrean file, pengguna dapat melakukan *deselect* dengan cara mengklik area kosong di luar kotak antrean file.

## 9. Jalan Pintas (Shortcut) Riwayat File (Recent Files)
- **Shortcut Riwayat:** Menambahkan *shortcut* keyboard `Ctrl + H` untuk membuka panel riwayat file yang telah diproses (Processed Files History). Info *shortcut* ini harus ditambahkan ke dalam menu Shortcuts di pengaturan.

## 10. Reorganisasi Tata Letak Toolbar
- **Pengelompokan Kiri (Tombol Aksi Utama):** Memindahkan tombol "Enhance", "Separate Stems", "Convert", dan "Record" ke sebelah kiri toolbar. Lebar kotak dari keempat tombol ini harus diseragamkan ukurannya sehingga sama dengan lebar tombol "Record".
- **Pengelompokan Kanan (Alat & Ikon Tambahan):** Memindahkan kotak pencarian (Search files), *dropdown filter* file, *dropdown convert to*, serta deretan ikon ke sebelah kanan toolbar. Perubahan tata letak toolbar ini harus konsisten pada tab Audio maupun tab Video.
