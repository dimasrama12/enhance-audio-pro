# plan_video.md — Video Drag-and-Drop → Audio Extraction Roadmap

> **Status:** Blueprint / not yet implemented.
> **Goal:** Let users drop video files (`.mp4`, `.mov`, `.mkv`) onto **either** the Enhance or Convert tab. The app silently demuxes the audio stream, transcodes it to a default `.mp3`, and injects the resulting audio job into the tab the drop landed on — while keeping the original video's base filename. No size or duration limits apply to video drops.

---

## 1. Scope & Requirements

| # | Requirement | Notes |
|---|---|---|
| R1 | Intercept `.mp4`, `.mov`, `.mkv` drops on **both** tabs (Enhance + Convert) | Convert tab currently rejects everything except `mp3`/`wav` — must be relaxed for these video types. |
| R2 | Bypass **all** size and duration constraints for video | No `MAX_QUEUE_JOBS`, no byte cap, no duration cap. (Queue is already unlimited — just don't add new gates.) |
| R3 | Background demux/extract of the audio stream | Runs in the Python sidecar via ffmpeg; UI never blocks. |
| R4 | Auto-convert extracted audio to default `.mp3` | Default container/codec = MP3. Configurable later; hardcode `mp3` for v1. |
| R5 | Inject the resulting audio into the **same tab** the file was dropped on | Enhance drop → Enhance queue; Convert drop → Convert queue. |
| R6 | Preserve the original video's **base filename** | `interview.mp4` → `interview.mp3`. |

**Out of scope for v1:** multi-audio-track selection (always take the first/default audio stream), embedded-subtitle handling, video re-muxing, keeping the video visible in the queue.

---

## 2. Current-State Findings (grounded in the code)

These are the exact touch points that already exist and what they do today:

- **`src/lib/fileValidation.ts`** — `VIDEO_EXTENSIONS` already contains `mp4`, `mov`, `mkv` (+ others). `validateFile()` returns `{ valid: true, mediaType: 'video' }` for them. So videos already pass generic validation.
- **`src/lib/importHelper.ts` → `handleImportFiles(paths)`** — the single entry point for all drops.
  - For the **Convert** tab it hard-filters to `ext === 'mp3' || 'wav'` (line ~18–23), which currently **drops video files silently**. This filter must become video-aware.
  - `submitAddFilesDirect()` calls `invokeAddFiles(paths)` (Rust) then `addJobs(res.data, tab)` into the active tab. For Convert it also force-sets an output format (mp3/wav swap).
- **`src-tauri/src/commands/queue.rs` → `add_files`** — already computes `media_type = "video"` for video extensions and persists the job via `insert_job(...)`. So a raw video job can already be created in SQLite.
- **`backend/processors/convert_audio.py` → `convert_file(...)`** — already runs ffmpeg with `-vn` (drops the video stream) and supports arbitrary input containers, using the bundled static ffmpeg from `imageio_ffmpeg.get_ffmpeg_exe()`. **This is effectively the demux-to-audio primitive we need** — feeding it `input=video.mp4, output=video.mp3` already extracts audio to MP3. No new ffmpeg dependency required.
- **`WaveformPlayer` / `read_audio_file`** — reads raw bytes of the active file path. A raw video path would technically decode in WebView2 for some codecs, but we do **not** want to preview the video; the queue must reference the extracted `.mp3`, not the source video.
- **Per-tab isolation** — `useQueueStore` stores jobs under `tabQueues[tab]`; the just-completed "Cancel All" isolation and A/B-toggle-per-tab work confirm the tab is the correct routing key.

**Design consequence:** the cleanest seam is a dedicated **extraction step that runs before/at import**, producing an audio path that flows through the *existing* audio pipeline. The queue should hold the extracted `.mp3`, tagged with `source_video_path` for provenance — the video itself is never enqueued as a playable/processable row.

---

## 3. Architecture — Extraction Flow

```
 ┌──────────────┐   drop .mp4/.mov/.mkv    ┌───────────────────────────┐
 │  DropZone /  │ ───────────────────────► │ handleImportFiles(paths)  │
 │  OS file drop│                          │  (importHelper.ts)        │
 └──────────────┘                          └────────────┬──────────────┘
                                                        │ split video vs audio paths
                                                        ▼
                                    ┌───────────────────────────────────────┐
                                    │ videoPaths → invokeExtractAudio(...)   │  (NEW IPC)
                                    │ audioPaths → existing submitAddFiles…  │
                                    └───────────────┬───────────────────────┘
                                                    │ Rust command
                                                    ▼
                            ┌──────────────────────────────────────────────┐
                            │ Rust: extract_video_audio (commands/video.rs) │  (NEW)
                            │  POST http://127.0.0.1:{port}/extract_audio    │
                            └───────────────┬────────────────────────────────┘
                                            │ FastAPI
                                            ▼
                    ┌────────────────────────────────────────────────────────┐
                    │ Python: routers/video.py  → processors/extract_audio.py│  (NEW)
                    │  ffmpeg -i video -vn -map 0:a:0 -c:a libmp3lame out.mp3  │
                    │  writes to scratch/cache dir, emits progress callbacks   │
                    └───────────────┬─────────────────────────────────────────┘
                                    │ returns { audio_path, base_name }
                                    ▼
                    ┌────────────────────────────────────────────────────────┐
                    │ Frontend: addJobs([extractedAudioJob], tab)             │
                    │  → job.filepath = extracted .mp3                         │
                    │  → job.source_video_path = original video path          │
                    └────────────────────────────────────────────────────────┘
```

**Why a pre-import extraction (not "enqueue video then process")?**
- Keeps the entire downstream pipeline (enhance, convert, waveform, A/B toggle, download) working unchanged on a normal audio path.
- Avoids special-casing every processor for "is this row a video?".
- Extraction is idempotent and cached, so re-dropping the same video is cheap.

---

## 4. Implementation Plan (phased)

### Phase V1 — Backend extraction primitive
1. **`backend/processors/extract_audio.py`** (new)
   - `extract_audio(input_path, output_path, progress_cb, fmt="mp3") -> None`
   - ffmpeg command:
     ```
     ffmpeg -y -loglevel error -nostdin -i <input> \
            -vn -map 0:a:0? -c:a libmp3lame -q:a 2 <output.mp3>
     ```
     - `-vn` drop video, `-map 0:a:0?` take first audio stream (the `?` makes it non-fatal if a stream index is absent), `-c:a libmp3lame -q:a 2` = high-quality VBR MP3.
   - Reuse `imageio_ffmpeg.get_ffmpeg_exe()` (same pattern as `convert_audio.py`).
   - Parse ffmpeg `-progress` pipe (or `-stats`) to emit `progress_cb(0..100)`; fall back to coarse 10→100 like `convert_audio.py` if duration probe fails.
   - **No size/duration guards** (R2). Do not probe-and-reject on length.
   - Write output into the **scratch/cache dir** (`SCRATCH_DISK_DIR` env, else system temp) under e.g. `enhance-audio-pro-cache/extracted/<base>.mp3` so app-close cleanup (`lib.rs`) already removes it.
2. **`backend/routers/video.py`** (new)
   - `POST /extract_audio` body `{ job_id?, input_path, out_dir?, fmt }`.
   - Reuse the **global `asyncio.Lock` + per-job heartbeat** pattern from `routers/convert.py` so concurrent extractions serialize and the UI gets "processing" callbacks.
   - Return `{ success, data: { audio_path, base_name, duration }, error }`.
   - Register the router in `backend/main.py`.
3. **Tests:** `backend/tests/test_extract_audio.py` — patch `subprocess.run`, assert the ffmpeg argv contains `-vn`, `-map 0:a`, `libmp3lame`, and the `.mp3` output path; assert progress reaches 100. (Follow the `conftest.py` uname-warm note for ffmpeg tests.)

### Phase V2 — Rust IPC bridge
4. **`src-tauri/src/commands/video.rs`** (new)
   - `#[tauri::command] async fn extract_video_audio(state, input_path, out_dir, fmt) -> IpcResponse<ExtractedAudio>`
   - `reqwest` POST to `http://127.0.0.1:{backend_port}/extract_audio` with the **retry/timeout** pattern already used in `process.rs` (cold-start tolerance).
   - `ExtractedAudio { audio_path, base_name, duration }` (serde).
5. Register the command in `src-tauri/src/commands/mod.rs` + `lib.rs` `invoke_handler!`.
6. Progress events: emit `queue://progress` / `queue://status-change` on the same channel the queue UI already listens to, keyed by a placeholder job id, so the extraction shows live progress in the row.

### Phase V3 — Frontend interception & injection
7. **`src/lib/ipc.ts`** — add `invokeExtractAudio(inputPath, outDir, fmt): Promise<IpcResponse<ExtractedAudio>>`.
8. **`src/lib/fileValidation.ts`** — add a helper `isVideoFile(name): boolean` (reuse `VIDEO_EXTENSIONS`).
9. **`src/lib/importHelper.ts` → `handleImportFiles`**
   - Partition incoming `paths` into `videoPaths` and `audioPaths`.
   - **Relax the Convert-tab filter** so it no longer discards video: allow `mp3`, `wav`, **and** any `isVideoFile(...)`.
   - For `videoPaths`:
     - Show a transient "Extracting audio from N video(s)…" importing state (reuse `tabImportingIds`).
     - For each: `await invokeExtractAudio(videoPath, scratchDir, 'mp3')`.
     - On success, treat the returned `audio_path` exactly like a dropped audio file → funnel into `submitAddFilesDirect([audio_path], …)` for the **active tab** (R5).
     - Preserve base name: the extracted file is already `<base>.mp3` (R6); ensure the queue row's `filename` shows `<base>.mp3` and store `source_video_path`.
   - For `audioPaths`: existing path unchanged.
   - Duplicate detection: dedupe on the **extracted audio path** (and/or `source_video_path`) so re-dropping the same video doesn't double-add.
10. **`src/types/queue.ts`** — extend `QueueJob` with optional `source_video_path?: string` (provenance; also lets the UI badge the row as "from video"). Persist it in SQLite via `insert_job` / migration if we want it durable (optional for v1 — can stay frontend-only/non-persisted first).
11. **UI affordances (optional, nice-to-have):**
    - Small "🎬 from video" chip on rows that came from extraction.
    - The WaveformPlayer already gets a plain audio path, so playback/A-B behavior needs **no** change.

### Phase V4 — Cleanup, persistence, tests
12. **Cache cleanup:** extracted MP3s live under the scratch/cache dir already wiped on app close in `lib.rs`. Confirm the `extracted/` subfolder is included in that recursive delete.
13. **Frontend tests (Vitest):**
    - `handleImportFiles` routes a `.mp4` drop through `invokeExtractAudio` and injects the returned audio into the active tab.
    - Convert tab now accepts video (no longer silently dropped).
    - Base filename preserved (`clip.mov` → row shows `clip.mp3`).
14. **Manual E2E:** drop a large `.mkv` (multi-GB) on both tabs → verify no size rejection, audio extracts, job enhances/converts normally, cache cleared on close.

---

## 5. Edge Cases & Decisions

| Case | Decision |
|---|---|
| Video has **no audio stream** | ffmpeg `-map 0:a:0?` yields empty/erroring output → surface a friendly "No audio track found in `<name>`" toast; do **not** enqueue a broken row. |
| Video has **multiple audio tracks** | v1: take first (`0:a:0`). Future: track picker. |
| **Filename collision** in scratch dir (`clip.mp3` from two different `clip.*`) | Suffix with a short hash of the source path: `clip.<hash8>.mp3` internally, but display `clip.mp3`. |
| Same video dropped **twice** | Dedupe by `source_video_path` (normalized) within the tab; reuse cached extraction if present. |
| Drop **mixes** audio + video files | Partition and handle each set with its own path; both land in the same active tab. |
| **Convert tab** semantics | Extracted MP3 becomes a normal Convert input; existing mp3→wav / wav→mp3 default output logic applies (extracted mp3 defaults its target to `wav`, matching current behavior). Revisit if undesirable. |
| Extraction **failure / ffmpeg error** | Report per-file error via the existing import-error toast; other files in the batch still proceed. |
| Very long video, **no duration cap** (R2) | Do not probe-to-reject. Progress may be coarse if duration unknown — acceptable. |

---

## 6. Files to Add / Touch (checklist)

**New**
- `backend/processors/extract_audio.py`
- `backend/routers/video.py`
- `backend/tests/test_extract_audio.py`
- `src-tauri/src/commands/video.rs`

**Modify**
- `backend/main.py` (register `video` router)
- `backend/build.spec` (ensure new modules bundled; `imageio_ffmpeg` already included)
- `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs` (register `extract_video_audio`)
- `src-tauri/src/lib.rs` (confirm `extracted/` in scratch cleanup)
- `src/lib/ipc.ts` (`invokeExtractAudio`)
- `src/lib/fileValidation.ts` (`isVideoFile`)
- `src/lib/importHelper.ts` (partition + Convert-tab filter relax + extraction wiring)
- `src/types/queue.ts` (`source_video_path?`)
- Vitest suites under `src/**/__tests__`

---

## 7. Acceptance Criteria

1. Dropping `interview.mp4` on **Enhance** produces `interview.mp3` in the Enhance queue and it enhances normally.
2. Dropping `interview.mov` on **Convert** produces `interview.mp3` in the Convert queue and it converts normally (no longer silently rejected).
3. Dropping a multi-GB `.mkv` is **not** rejected for size or duration.
4. Extraction happens in the background — the UI stays responsive and shows progress.
5. Extracted audio uses **MP3** by default and keeps the **original base filename**.
6. Files land only in the tab they were dropped on (tab isolation preserved).
7. Scratch/cache extracted files are removed on app close.
8. Backend Pytest + frontend Vitest for the new paths pass; `npx tsc --noEmit` clean; `cargo check` clean (with `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro`).

---

_This is a planning document. No runtime behavior changes until the phases above are implemented and reviewed._
