TUJUAN
Aplikasi desktop audio enhancement (DeepFilterNet-based) saat ini kalah kualitas persepsi dari Adobe Podcast (web) meski parameter objektif (STOI) kompetitif. Root cause sudah teridentifikasi lewat benchmark kuantitatif + analisis LTAS. Tugasmu: investigasi codebase, susun rencana perbaikan tertulis (JANGAN langsung ubah kode), lalu tunggu approval sebelum implementasi.

KONTEKS TEMUAN (dari benchmark 5 sampel: kecil_1, sedang_1, sedang_2, parah_1, parah_2)
1. High-frequency energy management adalah gap utama, BUKAN dereverberation/noise floor midband.
   - Adobe Podcast memotong energi HF (3k-7k Hz) rata-rata -56% vs baseline asli.
   - Aplikasi (Strength 50 & 100) nyaris tidak memotong HF (~0%), sehingga hiss residual dari mic broadcast TVRI tetap terdengar.
   - Midband (100-1000 Hz) hampir identik antar semua sistem — bukan area masalah.
2. Jitter/artefak pumping jauh lebih tinggi di aplikasi (55-64% increase) vs Website (19.5%) — indikasi musical noise pasca DeepFilterNet.
3. STOI Strength 50 (0.858) lebih baik dari Strength 100 (0.78) — menaikkan Strength ke maksimum memperparah jitter tanpa menambah kejelasan. Default Strength=100 saat ini kemungkinan salah.

TARGET AKHIR
- Output aplikasi minimal setara Adobe Podcast dari sisi persepsi kebersihan (hiss tersamar), idealnya lebih baik karena mempertahankan detail natural.
- Jitter/artefak turun mendekati level Website (~20%), bukan 55-64%.
- STOI tetap terjaga atau membaik.
- Default Strength direkomendasikan ulang berdasarkan data, bukan asumsi.

FASE 1 — INVESTIGASI (lakukan dan laporkan sebelum lanjut ke Fase 2)
1. Baca seluruh pipeline audio processing di codebase ini. Petakan alur dari input file -> DeepFilterNet -> output final. Sertakan nama file dan fungsi yang terlibat.
2. Temukan bagaimana parameter "Strength" diimplementasikan secara teknis — apakah wet/dry mix linear (blend dry & processed signal), modifikasi parameter internal model DFN, atau lainnya. Kutip kode relevannya.
3. Cek apakah ada post-processing sesudah DeepFilterNet (EQ, limiter, high-shelf filter, gain smoothing) atau output DFN langsung dikirim jadi file final.
4. Cek sample rate, block size/chunk size, dan windowing yang dipakai saat inference DFN — ini relevan untuk sumber jitter/pumping artifact.
5. Identifikasi apakah ada mekanisme spectral gating atau noise gate tambahan di luar model.
6. Laporkan semua temuan investigasi dalam format ringkas sebelum lanjut ke Fase 2. Jangan mengubah kode apapun di fase ini.

FASE 2 — PLANNING (tulis ke file PLAN.md, jangan eksekusi dulu)
Berdasarkan hasil investigasi Fase 1 + temuan benchmark di atas, susun rencana perbaikan konkret mencakup:
1. Modul high-frequency attenuation pasca-DFN (misal high-shelf filter ringan di ~3-8kHz) untuk menyamarkan hiss residual tanpa merusak timbre — termasuk usulan parameter (cutoff freq, gain reduction dB, filter order/type).
2. Gain smoothing / envelope follower untuk redam jitter dan musical noise pasca-DFN (misal attack/release time constant pada gain envelope, atau smoothing antar-frame sebelum overlap-add).
3. Revisi default value Strength berdasarkan data STOI (rekomendasi awal: 50-60, tapi validasi ulang lewat testing jika parameternya bukan simple wet/dry mix).
4. Rencana testing: skrip untuk re-run benchmark yang sama (LTAS, jitter score, STOI) pada 5 sampel yang sama, membandingkan before/after perbaikan vs Website (Adobe Podcast) sebagai target.
5. Urutan implementasi bertahap (mana yang dikerjakan duluan, mana yang bisa rollback independen) supaya tiap perubahan bisa diukur dampaknya secara terpisah, bukan digabung sekaligus.

ATURAN KERJA
- Fase 1 dan Fase 2 WAJIB selesai dan ditampilkan/ditulis dulu sebelum menyentuh kode implementasi.
- Jangan asumsikan struktur kode — baca dulu, kutip yang relevan.
- Semua rekomendasi teknis harus dikaitkan balik ke data benchmark di atas (jangan generic advice).
- Setelah PLAN.md selesai, berhenti dan tunggu instruksi lanjut sebelum mulai coding.