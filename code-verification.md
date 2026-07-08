# Code Verification — Kutipan Kode Asli

> Dokumen ini memuat kutipan kode **persis** dari source files untuk keperluan verifikasi laporan.
> Tidak ada kode yang dimodifikasi atau disimpulkan — semua potongan dikutip verbatim dari file aslinya.

---

## 1. Deteksi Ekstensi Audio vs Video (Drag-and-Drop)

**File:** `src/lib/fileValidation.ts`

Komponen ini mendefinisikan dua `Set` ekstensi dan tiga fungsi ekspor. `validateFile()` dipakai oleh `DropZone.tsx` untuk setiap file yang dijatuhkan; hasilnya menentukan apakah file masuk jalur audio langsung atau jalur ekstraksi video. `isVideoFile()` dipakai oleh `importHelper.ts` saat mempartisi daftar file impor. `normalizeOsPath()` menangani masalah khusus Windows di mana webview Tauri mengembalikan path dengan prefix `\\?\` yang ditolak oleh ffmpeg.

```typescript
import type { MediaType } from '@/types/queue';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'ape',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'mts', 'm2ts',
]);

export interface ValidationResult {
  valid: boolean;
  mediaType: MediaType | null;
  error: string | null;
}

export function validateFile(filename: string): ValidationResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (AUDIO_EXTENSIONS.has(ext)) return { valid: true, mediaType: 'audio', error: null };
  if (VIDEO_EXTENSIONS.has(ext)) return { valid: true, mediaType: 'video', error: null };
  return { valid: false, mediaType: null, error: `Unsupported format: .${ext || '(none)'}` };
}

export function getFilename(filepath: string): string {
  return filepath.split(/[\\/]/).pop() ?? filepath;
}

export function isVideoFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.has(ext);
}

/**
 * Normalize a path delivered by an OS drag-and-drop event.
 *
 * On Windows, wry (Tauri's webview) can hand back extended-length "verbatim"
 * paths prefixed with `\\?\` (or `\\?\UNC\` for shares) plus stray whitespace.
 * ffmpeg rejects the `\\?\` form with "Invalid argument", which is exactly why
 * drag-dropped videos failed to extract while the browse dialog (plain paths)
 * worked. Strip the prefix so drag-drop behaves identically to browsing.
 */
export function normalizeOsPath(p: string): string {
  let s = p.trim().replace(/^"+|"+$/g, '');
  if (s.startsWith('\\\\?\\UNC\\')) s = '\\\\' + s.slice('\\\\?\\UNC\\'.length);
  else if (s.startsWith('\\\\?\\')) s = s.slice('\\\\?\\'.length);
  return s;
}
```

**Lokasi pemakaian di importHelper.ts (baris 166):**

```typescript
let items: ImportItem[] = valid.map((p) => ({ path: p, isVideo: isVideoFile(getFilename(p)) }));
```

---

## 2. Fungsi Backend yang Memanggil FFmpeg untuk Ekstraksi Audio dari Video

**File:** `backend/processors/extract_audio.py`

Modul ini berisi seluruh logika ekstraksi audio dari file video. Fungsi `_ffmpeg_exe()` mengambil binary ffmpeg statis yang dibundel bersama paket PyInstaller via `imageio_ffmpeg`. Fungsi `_probe_duration_seconds()` menjalankan `ffmpeg -i` untuk membaca durasi total dari stderr. Fungsi utama `extract_audio()` menjalankan proses ffmpeg dengan flag `-progress pipe:1` untuk membaca progress secara real-time baris per baris, lalu memanggil `progress_cb` untuk setiap persentase baru.

```python
import re
import subprocess
from typing import Callable

# Video containers we accept for audio extraction. The frontend also guards
# on these, but keep a backend-side allowlist so the endpoint is self-contained.
SUPPORTED_VIDEO_FORMATS = [
    "mp4", "mov", "mkv", "avi", "webm", "m4v", "flv", "wmv", "ts", "mts", "m2ts",
]


def _ffmpeg_exe() -> str:
    # Use the static ffmpeg binary shipped with imageio-ffmpeg. PyInstaller
    # bundles it via collect_data_files('imageio_ffmpeg') in build.spec, so it
    # is available in the frozen sidecar without a system-wide ffmpeg install.
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _probe_duration_seconds(ffmpeg: str, input_path: str) -> float:
    """Best-effort total media duration (seconds).

    imageio-ffmpeg ships ffmpeg (not ffprobe), so we read the ``Duration:`` line
    that ffmpeg prints to stderr when invoked with no output file. Returns 0.0 if
    it can't be determined — in that case the caller falls back to an
    indeterminate progress bar instead of a real percentage.
    """
    try:
        proc = subprocess.run(
            [ffmpeg, "-hide_banner", "-i", input_path],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
        )
        # ffmpeg exits non-zero here (no output specified) but still prints the
        # duration banner to stderr, e.g. "Duration: 00:23:41.52, start: ...".
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr or "")
        if m:
            hours, minutes, seconds = int(m.group(1)), int(m.group(2)), float(m.group(3))
            return hours * 3600 + minutes * 60 + seconds
    except Exception:
        pass
    return 0.0


def extract_audio(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    fmt: str = "mp3",
) -> None:
    """Demux/transcode the first audio stream of a video into ``output_path``.

    Streams real progress to ``progress_cb`` (0-100) by parsing ffmpeg's
    ``-progress pipe:1`` output against the probed total duration.

    - ``-vn`` drops the video stream.
    - ``-map 0:a:0?`` takes the first audio stream; the trailing ``?`` makes the
      mapping optional so ffmpeg does not hard-fail when the stream index shifts,
      letting us surface a clean "no audio" error instead of a cryptic exit code.
    - No size or duration probing/guards — video drops bypass all such limits.
    """
    ffmpeg = _ffmpeg_exe()
    progress_cb(1)

    total = _probe_duration_seconds(ffmpeg, input_path)

    cmd = [
        ffmpeg, "-y", "-loglevel", "error", "-nostdin", "-nostats",
        "-progress", "pipe:1",
        "-i", input_path,
        "-vn", "-map", "0:a:0?",
    ]
    if fmt == "mp3":
        cmd += ["-c:a", "libmp3lame", "-q:a", "2"]
    # For any other requested container we let ffmpeg pick a sane default codec.
    cmd.append(output_path)

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    last_pct = 1
    try:
        if proc.stdout is not None:
            for raw_line in proc.stdout:
                line = raw_line.strip()
                # ffmpeg emits key=value lines; out_time_us is the microseconds
                # of media processed so far. Guard on total>0 (known duration).
                if line.startswith("out_time_us=") and total > 0:
                    value = line.split("=", 1)[1].strip()
                    if not value.lstrip("-").isdigit():
                        continue
                    current_s = int(value) / 1_000_000.0
                    pct = int(min(99, max(1, current_s / total * 100)))
                    if pct > last_pct:
                        last_pct = pct
                        progress_cb(pct)
                elif line == "progress=end":
                    break
    finally:
        stderr_output = proc.stderr.read() if proc.stderr is not None else ""
        proc.wait()

    if proc.returncode != 0:
        stderr = (stderr_output or "").strip()
        # A missing/empty audio stream typically yields "does not contain any stream"
        # or an output with no audio — normalise to a user-friendly message.
        if "does not contain any stream" in stderr or "Output file does not contain" in stderr:
            raise RuntimeError("No audio track found in the video.")
        raise RuntimeError(f"ffmpeg failed: {stderr}")

    progress_cb(100)
```

---

## 3. Logika Default Target Format di Modul Convert (Toggle mp3 ↔ wav)

**File:** `src/lib/importHelper.ts` — fungsi `processImportItem()`, baris 99–105

Logika ini dijalankan setiap kali sebuah file berhasil ditambahkan ke tab **Convert**. Sistem membaca ekstensi file sumber, lalu secara otomatis menetapkan format output ke kebalikannya: jika file masukan adalah `.mp3` maka target dipilih `wav`, dan untuk semua format lain (termasuk wav, flac, aac, dll.) target default-nya adalah `mp3`. Pemilihan ini ditulis ke Zustand store dan langsung dikirim ke SQLite via IPC.

```typescript
    // Convert tab: pre-select the opposite of the input format (mp3 ⇄ wav).
    if (tab === 'convert') {
      const inputExt = realJob.filename.split('.').pop()?.toLowerCase();
      const targetFmt = inputExt === 'mp3' ? 'wav' : 'mp3';
      store.setOutputFormat(realJob.id, targetFmt);
      void invokeSetOutputFormat(realJob.id, targetFmt);
    }
```

**Konteks fungsi penuh tempat snippet ini berada** (baris 62–117):

```typescript
async function processImportItem(
  item: ImportItem,
  placeholder: QueueJob,
  tab: AudioSubTab,
  outputFolder: string | null,
): Promise<void> {
  const store = useQueueStore.getState();
  try {
    let audioPath = item.path;
    let sourceVideo: string | undefined;

    if (item.isVideo) {
      // Pass the placeholder id so the backend streams extraction progress back
      // as `queue://progress` events that light up this exact row.
      const res = await invokeExtractVideoAudio(item.path, 'mp3', placeholder.id);
      if (!res.success || !res.data) {
        store.removePlaceholder(placeholder.id, tab);
        toast(res.error ?? `Failed to extract audio from "${getFilename(item.path)}".`, 'error');
        return;
      }
      audioPath = res.data.audio_path;
      sourceVideo = item.path;
    }

    const addRes = await invokeAddFiles([audioPath]);
    if (!addRes.success || !addRes.data || addRes.data.length === 0) {
      store.removePlaceholder(placeholder.id, tab);
      toast(addRes.error ?? `Failed to add "${getFilename(item.path)}".`, 'error');
      return;
    }

    const dbJob = addRes.data[0];
    const realJob: QueueJob = sourceVideo ? { ...dbJob, source_video_path: sourceVideo } : dbJob;
    store.resolvePlaceholder(placeholder.id, realJob, tab);

    prewarmAudio(realJob.filepath);

    // Convert tab: pre-select the opposite of the input format (mp3 ⇄ wav).
    if (tab === 'convert') {
      const inputExt = realJob.filename.split('.').pop()?.toLowerCase();
      const targetFmt = inputExt === 'mp3' ? 'wav' : 'mp3';
      store.setOutputFormat(realJob.id, targetFmt);
      void invokeSetOutputFormat(realJob.id, targetFmt);
    }

    // Default destination so the Python side always has a real output folder.
    if (outputFolder && !realJob.destination) {
      store.setDestination(realJob.id, outputFolder);
      void invokeSetDestination(realJob.id, outputFolder);
    }
  } catch (err) {
    console.error('Background import failed:', item.path, err);
    store.removePlaceholder(placeholder.id, tab);
    toast(`Failed to import "${getFilename(item.path)}".`, 'error');
  }
}
```

---

## 4. Skema Database SQLite untuk Tabel Antrean File

**File:** `src-tauri/src/db/migrations.rs`

Fungsi `run_migrations()` dipanggil sekali saat aplikasi startup. Blok `CREATE TABLE IF NOT EXISTS` mendefinisikan skema awal tabel `queue_jobs`. Kolom-kolom tambahan (yang ditambahkan di fase pengembangan berikutnya) masing-masing dieksekusi dalam blok `execute_batch` terpisah dengan `let _ =` (mengabaikan error) agar idempoten — jika kolom sudah ada dari sesi sebelumnya, `ALTER TABLE` akan gagal tanpa mematikan aplikasi.

```rust
use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS queue_jobs (
            id            TEXT    PRIMARY KEY NOT NULL,
            filename      TEXT    NOT NULL,
            filepath      TEXT    NOT NULL,
            destination   TEXT    NOT NULL DEFAULT '',
            size_bytes    INTEGER NOT NULL DEFAULT 0,
            media_type    TEXT    NOT NULL DEFAULT 'audio',
            status        TEXT    NOT NULL DEFAULT 'pending',
            progress      INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            created_at    TEXT    NOT NULL,
            updated_at    TEXT    NOT NULL
        );",
    )?;
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN error_message TEXT;",
    );
    // Phase 4: per-job output format selection
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN output_format TEXT NOT NULL DEFAULT 'wav';",
    );
    // Phase 6: per-job bitrate and output filepath tracking
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN bitrate TEXT NOT NULL DEFAULT '';",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN output_filepath TEXT;",
    );
    // Phase 8: per-job sample rate
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN sample_rate TEXT NOT NULL DEFAULT '44100';",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN download_path TEXT;",
    );
    Ok(())
}
```

**Ringkasan kolom tabel `queue_jobs`:**

| Kolom | Tipe | Default | Keterangan |
|---|---|---|---|
| `id` | TEXT (PK) | — | UUID unik per job |
| `filename` | TEXT | — | Nama file tampilan (basename) |
| `filepath` | TEXT | — | Path absolut ke file sumber |
| `destination` | TEXT | `''` | Folder output tujuan |
| `size_bytes` | INTEGER | `0` | Ukuran file dalam bytes |
| `media_type` | TEXT | `'audio'` | `'audio'` atau `'video'` |
| `status` | TEXT | `'pending'` | `pending` / `queued` / `processing` / `done` / `error` / `cancelled` |
| `progress` | INTEGER | `0` | Persentase 0–100 |
| `error_message` | TEXT | NULL | Pesan error terakhir |
| `created_at` | TEXT | — | Timestamp saat file diimpor |
| `updated_at` | TEXT | — | Timestamp pembaruan terakhir |
| `output_format` | TEXT | `'wav'` | Format output yang dipilih user (ditambah Phase 4) |
| `bitrate` | TEXT | `''` | Bitrate target, misal `'192k'` (ditambah Phase 6) |
| `output_filepath` | TEXT | NULL | Path file hasil processing (ditambah Phase 6) |
| `sample_rate` | TEXT | `'44100'` | Sample rate target dalam Hz (ditambah Phase 8) |
| `archived` | INTEGER | `0` | `0` = aktif, `1` = masuk History panel (ditambah Phase 8) |
| `download_path` | TEXT | NULL | Path unduhan model wizard (ditambah Phase 8) |

---

*Dokumen ini dibuat untuk keperluan verifikasi laporan. Tidak ada kode yang dimodifikasi.*
