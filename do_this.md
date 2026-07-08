Saya ingin menghapus fitur audio manipulation panel dan stem separation (Demucs) 
dari aplikasi Enhance Audio Pro, karena keduanya di luar scope resmi aplikasi 
(hanya Enhance + Convert). Fungsi Enhance, Convert, DropZone, QueueGrid, 
WaveformPlayer, History, Settings, Keyboard Shortcuts, dan Recording TIDAK BOLEH 
terpengaruh sama sekali.

STEP 1 — INVENTARISASI (lakukan ini dulu, tampilkan hasilnya, JANGAN hapus apa pun dulu):
Cari dan daftar seluruh file yang terkait dengan:
1. ManipulationPanel.tsx dan seluruh sub-komponennya (8 tab: trim/speed/pitch/fade)
2. EQPanel.tsx (11-band parametric EQ)
3. Fitur merge/gabung file audio
4. Demucs / htdemucs_ft (stem separation) — termasuk processor Python-nya, 
   router FastAPI-nya, model weights terkait di folder models, dan referensi 
   download-nya di SetupWizard
5. Tab/pill "Separate" di QueueToolbar.tsx
6. Command Rust (commands/manipulate.rs dan command lain yang khusus melayani 
   fitur di atas)
7. Semua invoke() wrapper terkait di lib/ipc.ts
8. Registrasi command tersebut di src-tauri/src/lib.rs (invoke_handler)
9. Router FastAPI terkait (routers/manipulate.py, routers/equalizer.py jika 
   terpisah, router stem separation) dan pendaftarannya di backend/main.py
10. Semua test (Vitest & Pytest) yang mereferensikan modul-modul di atas

STEP 2 — KONFIRMASI SEBELUM HAPUS:
Setelah inventarisasi, tampilkan daftar lengkap file yang akan dihapus/diubah 
dan bagian mana dari setiap file yang akan diedit (bukan dihapus penuh) — 
misalnya lib.rs, main.py, ipc.ts, QueueToolbar.tsx yang perlu tetap ada tapi 
sebagian isinya dibuang. Tunggu saya bilang "lanjut hapus" sebelum eksekusi.

STEP 3 — EKSEKUSI (setelah saya konfirmasi):
1. Hapus file yang murni khusus untuk fitur ini (ManipulationPanel.tsx, 
   EQPanel.tsx, processor manipulate/equalizer/merge/demucs Python, 
   router terkait, commands/manipulate.rs).
2. Edit file yang dipakai bersama (lib.rs, main.py, ipc.ts, QueueToolbar.tsx, 
   useQueueStore.ts jika ada field operationType khusus "separate"/"manipulate") 
   — hapus HANYA baris terkait fitur ini, jangan sentuh baris lain.
3. Hapus dependency Python khusus Demucs dari requirements.txt/build.spec 
   JIKA tidak dipakai fitur lain manapun (cek dulu apakah enhance_speech.py 
   atau processor lain ikut import torch/demucs bersama).
4. Hapus/nonaktifkan test yang gugur karena modul dihapus.
5. Jalankan test suite penuh (Vitest 38 tests, Pytest 67 tests sebelumnya) 
   dan laporkan hasilnya — pastikan test untuk enhance, convert, extract_audio, 
   queue, dan settings semua tetap lulus.

STEP 3 TAMBAHAN — Hapus LavaSR, sisakan DeepFilterNet sebagai satu-satunya model enhancement.

KONTEKS: Aplikasi saat ini punya 2 model pilihan (aiModel: 'deepfilternet' | 'lavasr'), 
dipilih user lewat Settings. Hasil LavaSR kualitasnya buruk — mau dihapus total, 
DeepFilterNet jadi satu-satunya opsi (tidak perlu dropdown/pilihan model lagi).

Fungsi yang TIDAK BOLEH terpengaruh: seluruh jalur Enhance (DeepFilterNet), 
Convert, DropZone, QueueGrid, WaveformPanel, History, Settings (bagian lain 
selain model selector), Keyboard Shortcuts, Recording.

STEP 3A — INVENTARISASI (tampilkan hasil, JANGAN eksekusi dulu):
Cari dan daftar seluruh referensi ke:
1. Processor Python LavaSR (kemungkinan backend/processors/enhance_lavasr.py) 
   — apa isinya, dan apakah dia share helper function dengan enhance_speech.py 
   (DeepFilterNet) yang harus TETAP ADA jika dipakai bersama.
2. Router/endpoint FastAPI yang menangani pemilihan model — apakah 
   routers/enhance.py punya branching if aiModel == 'lavasr' vs terpisah 
   sepenuhnya, atau ada endpoint sendiri.
3. Dependency Python khusus LavaSR di requirements.txt dan build.spec 
   (cek dulu apakah dependency itu shared dengan DeepFilterNet/torchaudio 
   — jangan hapus jika dipakai bersama).
4. Field aiModel di: useSettingsStore.ts (default value, type definition), 
   SettingsPanel.tsx (UI dropdown/selector-nya), DEFAULT_KEYBOARD_SHORTCUTS 
   atau saveSettings() di useKeyboardShortcuts.ts, dan setiap pemanggilan 
   invokeProcessQueue yang mem-pass parameter aiModel.
5. Command Rust yang menerima parameter model (kemungkinan commands/process.rs) 
   — apakah dia forward string aiModel ke FastAPI atau ada logic percabangan 
   di Rust juga.
6. Model weights/binary LavaSR di folder models dan referensi download-nya 
   di SetupWizard.tsx (jika LavaSR di-download terpisah saat first-launch).
7. Semua test (Vitest & Pytest) yang mereferensikan LavaSR atau aiModel selector.

STEP 3B — KONFIRMASI:
Tampilkan rencana perubahan: file yang dihapus penuh vs diedit sebagian 
(termasuk bagaimana signature invokeProcessQueue/process_queue command 
disederhanakan setelah parameter model dihapus — apakah aman dihapus dari 
signature atau cukup di-hardcode ke 'deepfilternet' agar tidak breaking 
banyak call site). Tunggu saya bilang "lanjut hapus" sebelum eksekusi.

STEP 3C — EKSEKUSI (setelah konfirmasi):
1. Hapus processor Python LavaSR dan test terkait.
2. Hapus dependency khusus LavaSR dari requirements.txt/build.spec JIKA 
   tidak shared dengan DeepFilterNet.
3. Sederhanakan field aiModel: hapus dari settings type, UI, dan seluruh 
   call site — pastikan invokeProcessQueue tidak lagi butuh parameter model, 
   atau default permanen ke 'deepfilternet' jika penghapusan parameter 
   terlalu invasif untuk lingkup ini.
4. Hapus referensi download model LavaSR di SetupWizard jika ada.
5. Jalankan Vitest + Pytest penuh, laporkan hasil — pastikan test Enhance, 
   Convert, Extract, Queue, Settings tetap lulus.

STEP 3D — VERIFIKASI MANUAL:
Jalankan npm run tauri dev. Konfirmasi: tab Enhance jalan normal tanpa 
dropdown model (atau dropdown hilang total dari Settings), tidak ada 
error console soal field/import yang hilang.

Jangan eksekusi 3C tanpa konfirmasi eksplisit saya setelah melihat hasil 3A/3B.

STEP 4 — VERIFIKASI:
Setelah semua lulus, pastikan tab Enhance dan Convert masih berfungsi normal, tidak ada tombol/menu 
mati (dead link) yang tersisa mengarah ke fitur yang sudah dihapus.

STEP 5 — REBUILD INSTALLER (hanya setelah Step 4 saya konfirmasi OK):
Ikuti Build Hygiene Rules yang sudah ada di architecture.md:
1. Kill semua proses backend.exe yang berjalan
2. Hapus folder backend/build/ sebelum build ulang (atau pakai --clean)
3. Set $env:CARGO_TARGET_DIR = 'D:\cargo_build\enhance-audio-pro' sebelum 
   command cargo apapun
4. Build ulang sidecar Python: python -m PyInstaller build.spec --clean --noconfirm
5. Copy backend.exe ke src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe
6. Build installer: npm run tauri build -- --target x86_64-pc-windows-gnu
7. Laporkan ukuran installer akhir — seharusnya LEBIH KECIL dari 367 MB 
   sebelumnya karena model Demucs (biasanya ratusan MB) sudah tidak perlu 
   dibundel/didownload.

Jangan lakukan Step 3, 4, 5 tanpa konfirmasi eksplisit dari saya di setiap step.