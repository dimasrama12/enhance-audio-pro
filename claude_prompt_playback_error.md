# Claude Code Prompt: WaveformPlayer Race Condition Fix

Halo Claude, saya mengalami bug "Race Condition" pada aplikasi Tauri + React + WaveSurfer.js saya. 
Tolong perbaiki bug ini tanpa mengubah arsitektur utama dan tanpa merusak fitur lainnya.

## Konteks Arsitektur (File: `src/components/WaveformPlayer.tsx`):
1. Kita menggunakan persistent shared `HTMLAudioElement` (`getSharedAudioPipeline()`) yang di-passing ke WaveSurfer via parameter `media`. Ini sangat krusial karena jika kita membuat ulang `MediaElementAudioSourceNode` dan elemen `<audio>` di setiap pergantian file, router Web Audio API di Chromium akan crash (suara hilang total).
2. Saat user berganti file dari antrian, prop `filepath` berubah, yang memicu `useEffect` untuk memuat file baru tanpa melakukan unmount pada instance WaveSurfer.
3. Di dalam `useEffect` pergantian file tersebut, kita membersihkan source lama dengan `mediaEl.removeAttribute('src'); mediaEl.load();` sebelum memuat file baru, agar memori tidak bocor.
4. Kita melakukan caching Blob URL (di `audioCache`) supaya file yang sudah pernah dimuat tidak perlu di-fetch ulang dari backend Tauri.

## Masalah yang Terjadi:
Ketika saya berganti menekan icon play dari antrian file satu ke file lain secara berulang (rapid swapping), muncul pesan error UI berwarna merah:
`Playback Error`
`Playback error: NotSupportedError: The element has no supported sources.`

Error ini tertangkap di blok `catch` pada eksekusi `playPause()` atau `play()`, yang kemudian memanggil `setLoadError()`.

## Dugaan Penyebab:
1. Penggunaan `mediaEl.removeAttribute('src')` diikuti dengan `ws.load(cached.blobUrl)` mungkin menyebabkan elemen audio HTML5 kehilangan sinkronisasi. Jika WaveSurfer menganggap URL barunya sama dengan URL lama (karena cache hit), ia mungkin skip melakukan set `src`, sehingga browser mencoba memutar elemen kosong.
2. Race condition antara promise `media.play()` dari file sebelumnya yang belum selesai saat kita tiba-tiba menghapus source-nya. 

## Tugas Kamu (Claude Code):
1. Analisis `src/components/WaveformPlayer.tsx`, khususnya pada bagian `useEffect` untuk file load, dan blok `catch` di fungsi `togglePlay` serta handler keyboard.
2. Temukan akar penyebab mengapa DOM melemparkan `NotSupportedError: The element has no supported sources` saat pergantian audio cepat.
3. Terapkan fix yang *bulletproof* untuk mengatasi race condition ini.
4. **ATURAN MUTLAK:** Jangan hapus fitur `audioCache`. Jangan hapus sistem persistent shared pipeline (`getSharedAudioPipeline`). Jangan merusak fitur volume (dB), jlSpeed (speed ladder), dan shortcut keyboard yang sudah jalan dengan baik.
