# PLAN.md — Perbaikan Kualitas Persepsi Enhance (DeepFilterNet vs Adobe Podcast)

> Status: **RENCANA — belum dieksekusi.** Dokumen ini adalah hasil Fase 1 (investigasi) + Fase 2 (planning) dari `do this.md`. Tidak ada kode yang diubah. Menunggu approval sebelum implementasi.
> Tanggal: 2026-07-31

---

## FASE 1 — HASIL INVESTIGASI (dengan kutipan kode)

### 1. Peta alur pipeline enhance (input → DeepFilterNet → output final)

| Lapisan | File : fungsi | Peran |
|---|---|---|
| Frontend (React) | `src/components/QueueToolbar.tsx:131`, `src/components/QueueGrid.tsx:265` → `src/lib/ipc.ts:63` `invokeProcessQueue(jobIds, enhancementStrength, aiModel)` | Kirim job + nilai Strength (0–100) ke Rust. Default `enhancementStrength: 50` di `src/types/settings.ts:113`. Slider `min=0 max=100` di `src/components/SettingsPanel.tsx:389`. |
| Rust (Tauri) | `src-tauri/src/commands/process.rs:11` `process_queue` | Set status `processing`, **normalisasi Strength 0–100 → 0.0–1.0** (`process.rs:58`: `enhancement_strength.unwrap_or(50.0).clamp(0.0,100.0)/100.0`), POST ke Python `/enhance` (payload `process.rs:60-65`, retry hingga 45×). |
| Python router | `backend/routers/enhance.py:40` `/enhance` → `:62` `_process_jobs` | Serialisasi via `_enhance_lock` (`enhance.py:23`), baca row DB, panggil `enhance_file(filepath, out, _progress, strength=_strength, job_id)` di executor (`enhance.py:157`). |
| Python processor | `backend/processors/enhance_speech.py:94` `enhance_file` | **Inti pemrosesan DSP.** Load model (`:34` `_load_model`), map strength→atten (`:122`), load audio @48kHz (`:136`), proses per-chunk 5 dtk (`:150-161`), concat + simpan (`:166-195`). |
| Output | `enhance.py:179-183` callback `status=done` + `output_filepath` → Rust → frontend | File hasil di cache scratch, ditampilkan di WaveformPlayer / disalin ke tujuan. |

**Kesimpulan struktural:** seluruh pemrosesan spektral terjadi HANYA di `enhance_file` (`enhance_speech.py`). Titik injeksi perbaikan yang tepat = tepat setelah `enhanced_audio = torch.cat(enhanced_chunks)` (`enhance_speech.py:166`) dan sebelum `save_audio` (`:175`).

### 2. Bagaimana "Strength" diimplementasikan (BUKAN wet/dry linear)

Strength dipetakan ke parameter internal DeepFilterNet **`atten_lim_db`** (attenuation limit dalam dB), bukan blend dry/processed linear:

```python
# backend/processors/enhance_speech.py:121-122
# Map 0.0-1.0 to atten_lim_db: strength 1.0 → 40 dB, 0.0 → 0 dB (pass-through)
atten_lim_db = max(0.0, min(40.0, strength * 40.0))
...
# :157
processed_chunk = enhance(model, df_state, chunk, atten_lim_db=atten_lim_db)
```

Perilaku `atten_lim_db` di DeepFilterNet (`df/enhance.py`, lib hanya ada di dalam exe frozen — dikutip dari sumber resmi DeepFilterNet): membatasi atenuasi maksimum dengan **mencampur balik sinyal noisy**, secara efektif ini wet/dry TAPI dalam domain dB dan terbalik:

```
lim = 10 ** (-atten_lim_db / 20)
out = noisy * lim + enhanced * (1 - lim)   # hanya jika abs(atten_lim_db) > 0
```

| Strength UI | atten_lim_db | lim | Porsi dry (noisy) | Efek |
|---|---|---|---|---|
| 100 | 40 dB | 0.01 | ~1% | paling agresif (hampir murni DFN) |
| 50 (default) | 20 dB | 0.10 | ~10% | 10% noisy dicampur balik |
| 0 | 0 dB | — (falsy) | **0% → 100% wet** | **BUG: docstring bilang "no effect", faktanya `atten_lim_db=0` di DFN dianggap None → efek PENUH** |

**Implikasi yang menjelaskan data benchmark:** Strength 100 = output DFN nyaris murni → musical noise/pumping maksimum (jitter +63.8%). Strength 50 mencampur 10% noisy → "men-dither" musical noise (jitter +55.3%, lebih rendah) + STOI lebih tinggi (0.858 vs 0.78). Ini **mengonfirmasi** temuan benchmark bahwa menaikkan Strength ke 100 justru memperburuk.

### 3. Post-processing setelah DeepFilterNet? → **TIDAK ADA**

`enhance_speech.py:166-195`: output `torch.cat(enhanced_chunks)` langsung `save_audio(...)` (WAV/FLAC/OGG native via soundfile), atau untuk MP3/AAC/OPUS lewat ffmpeg **hanya untuk transcoding kontainer/codec** (`:181-182`, tanpa filter spektral apa pun). **Tidak ada** EQ, high-shelf, limiter, de-esser, maupun gain smoothing. Inilah kekosongan yang membuat energi HF tidak pernah dipotong (ΔHF app ≈ 0% vs Website ≈ −56%).

### 4. Sample rate, block/chunk size, windowing

- **Sample rate:** 48 kHz (native DeepFilterNet3). `load_audio(process_path, sr=df_state.sr())` (`enhance_speech.py:136`), disimpan pada `df_state.sr()` (`:175`).
- **Chunk size:** 5 detik keras = 240.000 sampel (`enhance_speech.py:140-141`), tiap chunk diproses terpisah lalu `torch.cat`.
- **Windowing/STFT:** internal DeepFilterNet (hop 480 = 10 ms, window 960 = 20 ms, lookahead beberapa frame). `enhance(...)` dipanggil dengan `pad=True` default **per chunk**, artinya tiap batas chunk 5 dtk dipad ulang → potensi diskontinuitas/edge artifact di setiap boundary. Ini **sumber jitter/pumping sekunder** (selain musical noise DFN). df_state dibuat sekali per file (`_load_model` mengembalikan df_state baru tiap panggilan, dipanggil 1× per file di `:118`), jadi hidden state RNN kontinu antar-chunk, tapi padding per-panggilan tetap menimbulkan artefak batas.

### 5. Spectral gating / noise gate tambahan di luar model → **TIDAK ADA**

Tidak ada noise gate, spectral subtraction, atau VAD-gate manual. Satu-satunya "gating" adalah gain mask internal DeepFilterNet. Reduksi noise floor tinggi (91–99% pada semua sampel) memang datang murni dari DFN.

### Ringkasan angka benchmark (dari `hasil_benchmark/ringkasan_rata_rata.csv`, 5 sampel)

| Varian | Reduksi noise floor | Δ jitter | **Δ HF** | Jarak LTAS | Korelasi env | **STOI** |
|---|---|---|---|---|---|---|
| App Strength 50 | 91.4% | **+55.3%** | **−0.78%** | 6.18 | 0.816 | **0.858** |
| App Strength 100 | 93.6% | **+63.8%** | **−0.66%** | 7.41 | 0.705 | 0.780 |
| Website (Adobe) | 98.8% | **+19.5%** | **−56.1%** | 11.75 | 0.607 | 0.786 |

**Tiga fakta kunci untuk desain solusi:**
1. **HF gap = masalah utama.** Website memotong HF −56%, app ≈ 0% → hiss tersisa. Perlu atenuasi HF pasca-DFN.
2. **Jitter app 2.8–3.3× lebih tinggi dari Website** (terparah di sampel `parah_*`: +106–130%). Perlu smoothing.
3. **Strength 50 sudah optimal** (STOI 0.858 > Website 0.786, LTAS paling natural). Menaikkan ke 100 hanya memperburuk. Default kode saat ini SUDAH 50 — jangan dinaikkan.
4. Sisi positif app: LTAS paling dekat ke asli (6.18 vs 11.75) & korelasi envelope tertinggi (0.816) → app paling natural. **Target: pertahankan naturalness ini sambil menutup gap HF & jitter** (jangan meniru Website mentah-mentah yang merusak timbre).

---

## FASE 2 — RENCANA PERBAIKAN

Semua modul baru diletakkan **pasca-DFN**, di dalam `enhance_speech.py` antara `torch.cat` (`:166`) dan `save_audio` (`:175`), sebagai fungsi terpisah agar tiap tahap bisa di-flag on/off & di-rollback independen. Dependensi: **torchaudio sudah terpasang** (`requirements.txt:5`) dan menyediakan filter biquad siap pakai (`torchaudio.functional.treble_biquad`, dsb.) → **tidak butuh dependensi baru**, tidak butuh round-trip ffmpeg.

### Modul 1 — Atenuasi high-frequency pasca-DFN (prioritas #1, penutup gap utama)

**Tujuan:** meniru pemotongan HF Website (−56% energi) untuk menyamarkan hiss residual, TANPA se-agresif Website (yang merusak timbre: LTAS 11.75). Target Δ HF app dari −0.8% → sekitar **−30% s/d −45%** (di antara app lama dan Website), menjaga LTAS tetap lebih rendah dari Website.

**Implementasi yang diusulkan:** high-shelf biquad (Audio EQ Cookbook) via `torchaudio.functional.treble_biquad(enhanced_audio, sr, gain_db, central_freq, Q)`.

**Parameter awal (untuk dituning lewat benchmark):**
- `central_freq` (titik tengah shelf): **3500 Hz** (band 3k–7k Hz adalah area hiss per temuan #1).
- `gain_db`: **−6 dB** (awal). Range uji: −4, −6, −8, −10 dB.
- `Q`: **0.707** (Butterworth, transisi mulus, tanpa resonansi).
- Orde: 2nd-order (single biquad). Bila kurang, cascade 2× biquad (efektif 4th-order) untuk shelf lebih curam mendekati profil Website.

**Catatan desain vs data:** −6 dB high-shelf @3.5kHz ≈ memangkas energi pita HF (>4kHz) kira-kira −40% hingga −55% (tergantung distribusi spektral sampel) → sejajar dengan target, tanpa membuat centroid seturun Website pada kasus ekstrem. Karena app saat ini mempertahankan HF (centroid app ≈ asli), penurunan terkendali ini justru mendekatkan ke persepsi "bersih" Website sambil tetap lebih natural.

**Kaitan opsi ke UI:** shelf bisa (a) tetap konstan, atau (b) di-scale ringan oleh Strength. Rekomendasi awal: **konstan & terpisah dari Strength** (agar Strength murni mengatur agresivitas DFN, sedangkan "de-hiss HF" jadi konsep independen), dengan opsi memaparkannya sebagai slider "HF De-hiss" terpisah di tahap lanjut.

### Modul 2 — Gain smoothing / envelope follower (penurun jitter & musical noise)

**Tujuan:** turunkan Δ jitter app dari +55% mendekati level Website (~20%), khususnya pada sampel `parah_*` (+106–130%).

**Dua sub-opsi (uji terpisah, mulai dari yang paling murah):**

- **2a. Chunk overlap-crossfade (hilangkan artefak batas 5 dtk).** Ganti chunking keras di `enhance_speech.py:150` menjadi chunk overlap (mis. overlap 0.5–1 dtk) dengan cross-fade (equal-power) di area tumpang tindih, atau proses seluruh file sekaligus bila RAM cukup untuk durasi < ~3 menit. Menghapus diskontinuitas boundary (sumber jitter sekunder, temuan #4). Rollback mudah (kembali ke loop lama).

- **2b. Temporal envelope smoothing pasca-DFN.** One-pole smoothing pada envelope gain/energi sinyal enhanced untuk meredam fluktuasi frame-to-frame (musical noise). Konstanta waktu awal: **attack ≈ 5 ms, release ≈ 40–60 ms** (cukup cepat menjaga transien konsonan, cukup lambat meredam pumping). Implementasi: hitung short-time RMS (hop 10 ms sesuai DFN), smoothing asimetris attack/release, terapkan sebagai gain envelope termodulasi terbatas (mis. batasi koreksi ±3 dB agar tidak merusak dinamika bicara / korelasi envelope).

**Rekomendasi urutan:** kerjakan **2a dulu** (perubahan struktural bersih, tanpa mengubah karakter suara) → ukur; bila jitter masih tinggi, tambahkan **2b**.

### Modul 3 — Revisi default Strength (berbasis data)

- Data: STOI S50 = 0.858 > S100 = 0.78; jitter & LTAS juga lebih baik di 50. **Default kode saat ini sudah `enhancementStrength: 50`** (`src/types/settings.ts:113`) — jadi rekomendasi = **KONFIRMASI 50, JANGAN naikkan ke 100.**
- Tuning tambahan: setelah Modul 1 & 2 aktif, uji ulang Strength ∈ {40, 50, 60} untuk cari titik optimal baru (karena de-hiss HF mengurangi kebutuhan agresivitas DFN, mungkin 40–50 lebih baik).
- **Perbaiki bug dokumentasi/semantik Strength=0** (`enhance_speech.py:121`): `atten_lim_db=0` di DFN = efek penuh, BUKAN pass-through. Opsi: (a) perbaiki komentar, atau (b) petakan Strength kecil ke atten_lim_db minimum > 0 (mis. clamp ke ≥ 6 dB) agar slider monotonik & intuitif. Tidak urgent untuk kualitas, tapi cegah kebingungan.

### Modul 4 — Rencana testing (re-run benchmark yang sama)

Reuse `audio_quality_benchmark.py` (sudah ada, folder sampel terverifikasi ada: `C:\Users\User\OneDrive\Documents\kp dimas\tes audio video kp\tes audio berdasarkan noise`, 5 sampel × 4 varian).

**Langkah:**
1. **Skrip regenerasi** `scripts/regen_enhanced_benchmark.py` (BARU): untuk tiap `*_asli.wav`, panggil `enhance_file(...)` (dengan/ tanpa modul baru, via flag env) dan tulis `*_aplikasi(baru).wav` ke folder sampel. Menjalankan langsung `enhance_file` butuh env DeepFilterNet — jalankan di dalam venv frozen atau install `deepfilternet` di `.venv` (saat ini `df` belum ada di `.venv`, hanya di exe). Alternatif: driver kecil yang meng-hit endpoint `/enhance` sidecar lalu ambil output.
2. **Tambah varian di benchmark:** perluas `FILENAME_PATTERN` (`audio_quality_benchmark.py:75`) & `VARIAN_LABELS` (`:68`) untuk mengenali `aplikasi(baru)`, agar ikut di tabel/plot LTAS berdampingan dengan `aplikasi(50)`, `aplikasi(100)`, `website`.
3. **Metrik pembanding (sudah dihitung skrip):** Δ HF, delta_jitter_persen, STOI, jarak LTAS, korelasi envelope, echo_score. **Kriteria lulus per modul:**
   - Modul 1 sukses → Δ HF turun dari −0.8% ke target −30..−45%, STOI tidak turun > 0.02.
   - Modul 2 sukses → Δ jitter turun dari +55% ke < +35% (idealnya ~+20%), korelasi envelope tetap ≥ 0.80.
   - Regresi guard → jarak LTAS tetap < Website (11.75) supaya klaim "lebih natural" bertahan.
4. Simpan snapshot CSV before/after tiap tahap untuk audit trail.

### Modul 5 — Urutan implementasi bertahap (tiap tahap terukur & rollback independen)

Semua di belakang env-flag agar dampak tiap tahap diukur TERPISAH, bukan digabung:

| Tahap | Perubahan | Flag | Rollback | Ukur |
|---|---|---|---|---|
| **0** | Baseline: jalankan `regen` + benchmark pada kode SEKARANG (Strength 50) untuk memastikan angka reproduksibel sebelum menyentuh apa pun | — | — | Konfirmasi 0.858 STOI / +55% jitter / −0.8% HF |
| **A** | **Modul 1** high-shelf HF pasca-DFN | `EAP_HF_SHELF_DB` (0 = off) | set flag 0 | Δ HF, STOI, LTAS |
| **B** | **Modul 2a** chunk overlap-crossfade | `EAP_CHUNK_OVERLAP` | kembali loop lama | Δ jitter |
| **C** | **Modul 2b** envelope smoothing (jika B belum cukup) | `EAP_ENV_SMOOTH` | set flag off | Δ jitter, korelasi env |
| **D** | **Modul 3** konfirmasi/tuning default Strength + fix semantik Strength=0 | — | ubah 1 konstanta | STOI vs strength sweep |

**Prinsip:** A → ukur → B → ukur → (C jika perlu) → ukur → D. Jangan gabung. Tiap flag default OFF sampai tervalidasi, lalu di-hardcode ON setelah lulus kriteria. Setelah semua lulus, rebuild sidecar (PyInstaller `--clean`) + installer sesuai aturan build di CLAUDE.md (§18.14, target `x86_64-pc-windows-gnu`).

---

## Titik keputusan yang butuh input user sebelum coding
1. **Target agresivitas HF:** meniru Website penuh (−56%, lebih "bersih" tapi timbre berubah) atau kompromi natural (−30..−45%, rekomendasi kami)?
2. **HF de-hiss: parameter tetap** atau **slider baru terpisah** di Settings?
3. **Regenerasi benchmark:** boleh install `deepfilternet` ke `.venv` lokal (mempercepat iterasi), atau harus lewat sidecar frozen?

---

## HASIL IMPLEMENTASI & VALIDASI (2026-08-01 — setelah approval "continue process")

Modul 1, 2b, 3, dan harness testing (Modul 4) sudah diimplementasikan & divalidasi pada 5 sampel yang sama memakai model DeepFilterNet3 asli (Python 3.11 sistem + shim torchaudio, bukan mock). Semua diperiksa TERPISAH per tahap.

### Perubahan kode
- `backend/processors/enhance_speech.py`: tambah `_apply_hf_shelf` (Modul 1), `_apply_envelope_smoothing` (Modul 2b), `_post_process` (orkestrasi), helper `_env_float`/`_env_flag`; dipanggil setelah `torch.cat` sebelum `save_audio`. Perbaiki semantik Strength=0 (guard `atten_lim_db ≥ 1` untuk strength>0) + docstring akurat (Modul 3).
- `scripts/regen_enhanced_benchmark.py` (BARU): regen varian `aplikasi(baru)` via `enhance_file` asli.
- `audio_quality_benchmark.py`: kenali varian `aplikasi(baru)`.
- `backend/tests/test_enhance_speech.py`: fixture menonaktifkan DSP saat unit-test (torch di-mock).

### Parameter final (default kode, tanpa perlu env var)
| Stage | Parameter | Nilai final |
|---|---|---|
| Modul 1 HF shelf | `EAP_HF_SHELF_DB` / freq / Q | **−4 dB @ 3500 Hz, Q 0.707** (high-shelf `torchaudio.functional.treble_biquad`) |
| Modul 2b Env smooth | attack / release / max | **5 ms / 50 ms / ±3 dB** (default ON) |
| Modul 3 Strength | default | **50** (dikonfirmasi data; Strength=0 kini benar-benar pass-through) |

### Hasil benchmark (rata-rata 5 sampel) — SEMUA TARGET TERPENUHI
| Metrik | App S50 (lama) | **App Baru** | Website (Adobe) | Target `do this.md` | Status |
|---|---|---|---|---|---|
| Δ HF energi | −0.78% | **−40.0%** | −56.1% | −30..−45% | ✅ (masking kuat, lebih natural dari Website) |
| Δ jitter | +55.3% | **+16.6%** | +19.5% | ~20% | ✅ (di BAWAH Website) |
| STOI | 0.858 | **0.847** | 0.786 | terjaga | ✅ (di ATAS Website) |
| Jarak LTAS | 6.18 | 7.19 | 11.75 | < Website | ✅ (lebih natural) |
| Korelasi envelope | 0.816 | 0.814 | 0.607 | ≥0.80 | ✅ |

Per-sampel: setiap sampel MEMBAIK pada jitter vs app lama (parah_1 +108%→+52%, parah_2 +106%→+60%, kecil_1/sedang_1/sedang_2 kini ≤0). HF dipotong signifikan di semua sampel. STOI terjaga (0.783–0.976).

### Verifikasi
- **41/41 Pytest** (backend) hijau — termasuk 7 test `enhance_speech` (guard DSP saat mock).
- Benchmark reproducible dengan default kode (tanpa env override).
- Alternatif tuning tercatat: env smoothing lebih kuat (max 4 dB/release 60 ms) → jitter turun ke +7.9% tapi HF masking berkurang (−35%) & noise-floor reduction turun; dipilih yang seimbang (max 3 dB) demi menjaga masking hiss (keluhan utama).

### Cara mengubah tuning tanpa rebuild kode (env var, dibaca per-run)
`EAP_HF_SHELF_DB`, `EAP_HF_SHELF_FREQ`, `EAP_HF_SHELF_Q`, `EAP_ENV_SMOOTH` (0/1), `EAP_ENV_ATTACK_MS`, `EAP_ENV_RELEASE_MS`, `EAP_ENV_MAX_DB`.

### Sisa (belum dikerjakan)
- Modul 2a (chunk overlap-crossfade) TIDAK diperlukan — target jitter sudah tercapai via Modul 2b saja.
- Rebuild sidecar PyInstaller + standalone exe / installer agar perubahan aktif di aplikasi terpasang (langkah build, terpisah dari validasi DSP di atas).
- Opsional: paparkan "HF De-hiss" sebagai slider Settings terpisah dari Strength.
