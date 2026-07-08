# Step 1 — Inventarisasi Fitur yang Akan Dihapus

> Dibuat: 2026-07-06
> Tujuan: Menghapus ManipulationPanel (trim/speed/pitch/fade/EQ/merge/loop) dan Stem Separation (Demucs)
> Scope yang TIDAK BOLEH terpengaruh: Enhance, Convert, DropZone, QueueGrid, WaveformPlayer, History, Settings, Keyboard Shortcuts, Recording

---

## TEMUAN KRITIS — Baca Sebelum Eksekusi

### 1. ManipulationPanel.tsx sudah bukan panel manipulasi
File `src/components/ManipulationPanel.tsx` (63 baris) sudah di-strip sebelumnya.
Sekarang isinya **hanya wrapper untuk WaveformPlayer** — tidak ada tab trim/speed/pitch/fade.
- Menghapusnya = menghilangkan WaveformPlayer dari UI.
- Rekomendasi: **jangan hapus, rename saja** jadi `WaveformPanel.tsx` dan update import di `App.tsx`.

### 2. `export_volume_adjusted_audio` dipakai WaveformPlayer
Fungsi ini ada di:
- `src-tauri/src/commands/manipulate.rs` baris 166–191
- `backend/routers/manipulate.py` endpoint `/export_volume` baris 74–84

Dipakai oleh `src/components/WaveformPlayer.tsx` baris 183 untuk fitur download audio.
**Tidak boleh dihapus.** Kedua file ini harus diedit, bukan dihapus penuh.

### 3. Demucs sudah bersih di sebagian besar tempat
- Tidak ada `backend/routers/separate.py` — sudah dihapus sebelumnya
- Tidak ada `backend/processors/separate_stems.py` — sudah dihapus sebelumnya
- `demucs` tidak ada di `requirements.txt` maupun `build.spec`
- `invokeSeparateStems` di `ipc.ts` adalah **dead stub** — tidak ada Rust command yang terdaftar di `lib.rs`
- Sisa demucs hanya di mock `backend/tests/conftest.py`

---

## A. FILE YANG DIHAPUS PENUH (8 file)

| No | File | Isi yang Dihapus |
|----|------|-----------------|
| 1 | `src/components/EQPanel.tsx` | 11-band parametric EQ component — tidak diimport di mana pun (dead file) |
| 2 | `backend/processors/manipulate_audio.py` | trim_audio, speed_audio, pitch_audio, volume_audio, fade_audio |
| 3 | `backend/processors/merge_audio.py` | merge_files, loop_audio |
| 4 | `backend/processors/equalizer.py` | apply_eq, PRESETS (18 preset EQ) |
| 5 | `backend/tests/test_manipulate_audio.py` | 8 unit test untuk processor manipulate_audio |
| 6 | `backend/tests/test_manipulate_endpoint.py` | Test endpoint /manipulate, /merge, /loop, /eq |
| 7 | `backend/tests/test_merge_audio.py` | 5 unit test untuk merge_files dan loop_audio |
| 8 | `backend/tests/test_equalizer.py` | 5 unit test untuk apply_eq dan PRESETS |

---

## B. FILE YANG DIEDIT SEBAGIAN (5 file)

### B1. `src/lib/ipc.ts`
Hapus 5 wrapper function (baris 79–109):
```
- invokeSeparateStems     (baris 79–81)  — dead stub, tidak ada Rust command
- invokeManipulateAudio   (baris 91–97)
- invokeMergeAudio        (baris 99–101)
- invokeLoopAudio         (baris 103–105)
- invokeApplyEQ           (baris 107–109)
```
**Tetap:** `invokeExportVolumeAdjustedAudio` (baris 143–153) — dipakai WaveformPlayer

### B2. `src-tauri/src/lib.rs`
Hapus dari baris 13 (use statement):
```
manipulate_audio, merge_audio, loop_audio, apply_eq
```
Hapus dari invoke_handler![] (baris 150–153):
```
manipulate_audio,
merge_audio,
loop_audio,
apply_eq,
```
**Tetap:** `export_volume_adjusted_audio` di import dan handler

### B3. `src-tauri/src/commands/manipulate.rs`
Hapus 4 fungsi:
```
- fn manipulate_audio  (baris 8–45)
- fn merge_audio       (baris 47–90)
- fn loop_audio        (baris 92–127)
- fn apply_eq          (baris 129–164)
```
**Tetap:** `fn export_volume_adjusted_audio` (baris 166–191)

### B4. `backend/routers/manipulate.py`
Hapus:
```
- class ManipulateRequest
- class MergeRequest
- class LoopRequest
- class EQRequest
- POST /manipulate + _process_manipulate()
- POST /merge       + _process_merge()
- POST /loop        + _process_loop()
- POST /eq          + _process_eq()
- def _get_job_row()  (tidak dipakai /export_volume)
```
**Tetap:** `class ExportVolumeRequest` + `POST /export_volume`

### B5. `backend/tests/conftest.py`
Hapus bagian Demucs (baris 40–72):
```
- Semua _mock_demucs_* variable (baris 41–60)
- Entry demucs di loop sys.modules (baris 67–70)
```
**Tetap:** DeepFilterNet mocks, _mock_torch, _mock_torchaudio, platform.uname()

---

## C. TIDAK PERLU DIUBAH

| File | Alasan |
|------|--------|
| `src/components/ManipulationPanel.tsx` | Sudah berisi hanya WaveformPlayer — rename saja, jangan hapus |
| `src/App.tsx` | Import ManipulationPanel tetap diperlukan untuk WaveformPlayer |
| `backend/requirements.txt` | `demucs` tidak ada di sini; `torchaudio` dipakai LavaSR (enhance_lavasr.py) |
| `backend/build.spec` | Tidak ada `collect_all('demucs')` — sudah bersih |
| `src-tauri/src/commands/mod.rs` | `pub mod manipulate;` tetap diperlukan (export_volume masih di sana) |
| `backend/main.py` | `app.include_router(manipulate.router)` tetap diperlukan (/export_volume) |
| Vitest tests (3 file: fileValidation, useQueueStore, useSettingsStore) | Tidak ada referensi ke fitur yang dihapus |
| `src/components/QueueToolbar.tsx` | Tidak ada referensi "Separate" di file ini |

---

## D. RINGKASAN JUMLAH PERUBAHAN

| Tipe | Jumlah |
|------|--------|
| File dihapus penuh | 8 file |
| File diedit sebagian | 5 file |
| File tidak perlu diubah | 8 file |

---

## E. PERTANYAAN KONFIRMASI SEBELUM STEP 3

1. `ManipulationPanel.tsx` — **rename** jadi `WaveformPanel.tsx` atau biarkan nama lamanya?
2. Lanjut ke STEP 3 — ketik **"lanjut hapus"**

---

> Step 3, 4, 5 TIDAK akan dieksekusi tanpa konfirmasi eksplisit dari Anda di setiap step.
