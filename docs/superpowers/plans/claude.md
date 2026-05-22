# Enhance Audio Pro — Master Implementation Plan

> **RULE:** This is the single source-of-truth for all phase plans.
> Do NOT create new phase files. Always edit THIS file only.

---

## Phase 1 — App Scaffold (2026-05-20) ✓ COMPLETE

- [x] Task 1: Project scaffold — package.json, vite.config.ts, index.html, tailwind.config.js, postcss.config.js, npm install
- [x] Task 2: TypeScript types — src/types/ipc.ts, queue.ts, settings.ts
- [x] Task 3: File validation utility + 8 Vitest tests (TDD) — src/lib/fileValidation.ts
- [x] Task 4: Zustand stores + 8 Vitest tests (TDD) — useQueueStore, useSettingsStore
- [x] Task 5: IPC wrappers + React app entry — src/lib/ipc.ts, main.tsx, App.tsx, index.css
- [x] Task 6: All 7 UI components — TitleBar, Sidebar, DropZone, QueueToolbar, QueueGrid, SettingsPanel, SetupWizard (16/16 Vitest tests passing)
- [x] Task 7: Tauri v2 Rust scaffold — Cargo.toml, build.rs, tauri.conf.json, capabilities/default.json, main.rs, lib.rs, commands/mod.rs, db/mod.rs, sidecar/mod.rs
- [x] Task 8: SQLite database layer — db/migrations.rs (queue_jobs table), db/queue.rs (QueueJob, insert_job, get_all_jobs)
- [x] Task 9: Tauri IPC commands — commands/queue.rs (add_files, get_queue), commands/settings.rs (get_settings, save_settings), IpcResponse<T>
- [x] Task 10: Python sidecar lifecycle manager — sidecar/manager.rs (available_port, spawn)
- [x] Task 11: Python FastAPI backend — backend/main.py, routers/health.py, routers/queue.py (GET /health, POST /queue/process 501 placeholder; 2/2 Pytest passing)
- [x] Task 12: Binaries directory + sidecar wiring — externalBin in tauri.conf.json, sidecar/manager.rs fully wired
- [x] Task 13: First dev run + integration test — all tests green, cargo check passes

**Result:** 16/16 Vitest · 2/2 Pytest · cargo check clean

---

## Phase 2 — Speech Enhancement (2026-05-21) ✓ COMPLETE

- [x] Task 1: Cargo.toml — add axum 0.7, tokio-net, reqwest 0.12
- [x] Task 2: DB layer — progress/error_message migration, get_job_by_id, update_job_status, update_job_error (4 Rust unit tests)
- [x] Task 3: Rust callback server — axum, 3 POST handlers (/callback/progress, /callback/status, /callback/wizard)
- [x] Task 4: lib.rs + sidecar wiring — AppState gains callback_port, callback server spawned, CALLBACK_PORT passed to Python
- [x] Task 5: process_queue + start_model_download commands — sync commands with fire-and-forget async spawn
- [x] Task 6: Python requirements.txt + tests/conftest.py (mocks torch/df/torchaudio)
- [x] Task 7: processors/enhance_speech.py — lazy DeepFilterNet3 loader, CUDA/CPU fallback (4/4 Pytest TDD)
- [x] Task 8: routers/enhance.py — POST /enhance, BackgroundTasks (3/3 Pytest TDD)
- [x] Task 9: routers/wizard.py — POST /wizard/download, streaming HuggingFace download (2/2 Pytest TDD)
- [x] Task 10: main.py — all Phase 2 routers registered; 11/11 Pytest passing
- [x] Task 11: QueueJob type (progress, error_message) + useQueueStore (setProgress, setStatus) — 7/7 Vitest tests
- [x] Task 12: IPC wrappers — invokeProcessQueue, invokeStartModelDownload
- [x] Task 13: QueueGrid — progress bar column, queue://progress and queue://status-change subscriptions
- [x] Task 14: QueueToolbar — Process/Enhance button dispatches pending jobs
- [x] Task 15: SetupWizard — wired to real download with progress bar and error recovery
- [x] Task 16: Final integration — all tests run, CLAUDE.md updated, pushed to GitHub

**Result:** 19/19 Vitest · 11/11 Pytest · cargo check clean

---

## Phase 3 — Stem Separation (2026-05-21) ✓ COMPLETE

- [x] Task 1: conftest.py extended with Demucs mocks + torchaudio.load return value
- [x] Task 2: processors/separate_stems.py — lazy htdemucs_ft loader, CUDA/CPU fallback (4/4 Pytest TDD)
- [x] Task 3: routers/separate.py — POST /separate, BackgroundTasks, progress callbacks (3/3 Pytest TDD); requirements.txt adds demucs>=4.0.0; main.py registers 5 routers (18/18 Pytest)
- [x] Task 4: commands/separate.rs — separate_stems Tauri command, fire-and-forget to /separate; commands/mod.rs + lib.rs updated; cargo check clean
- [x] Task 5: ipc.ts — invokeSeparateStems wrapper; QueueToolbar — Separate Stems button (indigo, Scissors icon), Enhance renamed from Process (19/19 Vitest)
- [x] Task 6: Integration — full suites, CLAUDE.md + PRD updated, pushed to GitHub

**Result:** 19/19 Vitest · 18/18 Pytest · cargo check clean

---

## Phase 4 — Packaging, Conversion, Batch Limits (2026-05-22) ✓ COMPLETE

- [x] Task 1: DB + Rust + Frontend types — output_format column (idempotent migration), QueueJob struct, setOutputFormat store action (20/20 Vitest)
- [x] Task 2: processors/convert_audio.py — ffmpeg subprocess wrapper, SUPPORTED_FORMATS (4/4 Pytest TDD)
- [x] Task 3: routers/convert.py — POST /convert, BackgroundTasks, output_format-aware output path (3/3 Pytest TDD); main.py registers 6 routers (25/25 Pytest)
- [x] Task 4: commands/convert.rs — convert_files (fire-and-forget) + set_output_format; commands/mod.rs + lib.rs updated; cargo check clean
- [x] Task 5: Frontend IPC wrappers (invokeConvertFiles, invokeSetOutputFormat); QueueGrid — Output Format column with per-row select (7 formats); QueueToolbar — global format override + Apply All + Convert button (teal)
- [x] Task 6: commands/queue.rs — 30 audio / 10 video batch limits enforced at add_files; DropZone — 5-second rejection warning
- [x] Task 7: backend/build.spec — PyInstaller one-file spec for backend sidecar
- [x] Task 8: tauri.conf.json — bundle targets ["msi"] for Windows
- [x] Task 9: Integration — full suites, CLAUDE.md + PRD updated, pushed to GitHub

**Result:** 20/20 Vitest · 25/25 Pytest · cargo check clean

---

## Phase 5 — Audio Manipulation Tools (2026-05-22) ✓ COMPLETE

- [x] Task 1: processors/manipulate_audio.py — trim, speed, pitch, volume, fade (ffmpeg) (7/7 Pytest TDD); processors/merge_audio.py — concat+acrossfade, stream_loop (6/6 Pytest TDD); processors/equalizer.py — parametric EQ + 18 presets (6/6 Pytest TDD)
- [x] Task 2: routers/manipulate.py — POST /manipulate, /merge, /loop, /eq (6/6 Pytest TDD); main.py — manipulate router registered (51/51 Pytest total)
- [x] Task 3: commands/manipulate.rs — manipulate_audio, merge_audio, loop_audio, apply_eq; commands/mod.rs + lib.rs updated; cargo check clean
- [x] Task 4: ipc.ts — invokeManipulateAudio, invokeMergeAudio, invokeLoopAudio, invokeApplyEQ wrappers; useQueueStore — selectedJobId + setSelectedJob state; QueueGrid — row click selects/deselects job (highlight on selected)
- [x] Task 5: EQPanel.tsx — 11-band vertical sliders + 18 preset selector + reset button
- [x] Task 6: ManipulationPanel.tsx — 8-tab collapsible panel (Trim/Speed/Pitch/Volume/Fade/Merge/Loop/EQ), slides up with AnimatePresence when job selected; App.tsx — panel mounted below QueueGrid (20/20 Vitest)
- [x] Task 7: Phase 5 design spec — docs/superpowers/specs/2026-05-22-phase5-audio-manipulation-design.md
- [x] Task 8: CLAUDE.md updated, committed and pushed to GitHub

**Result:** 20/20 Vitest · 51/51 Pytest · cargo check clean

---

## Phase 6 — Polish, UX, Localization (2026-05-22) ✓ COMPLETE

- [x] Task 1: WaveformPlayer.tsx — WaveSurfer.js waveform bar (56px), Play/Pause/Stop controls, time display in Waveform tab
- [x] Task 2: A/B toggle — original vs enhanced, enabled when job status = 'done' and output_filepath exists
- [x] Task 3: Enhancement strength slider — 0–100 range in SettingsPanel, maps to DeepFilterNet atten_lim_db (0–40 dB); enhancementStrength in AppSettings + useSettingsStore
- [x] Task 4: Multi-select queue — selectedJobIds: string[] replaces selectedJobId; Ctrl+Click (toggle), Shift+Click (range), exclusive click; primarySelectedId() computed getter for ManipulationPanel backward compat
- [x] Task 5: Grid View / List View toggle — LayoutGrid/LayoutList button in QueueToolbar; card grid layout
- [x] Task 6: Localization framework — i18next + react-i18next; en.json base strings; 17 languages (en, id, zh, es, de, fr, ja, pt, ko, ru, ar, hi, it, nl, pl, tr, vi); SettingsPanel language selector wired to i18n.changeLanguage
- [x] Task 7: useKeyboardShortcuts hook — Ctrl+A (select all), Escape (deselect), Delete (remove selected), E (Enhance), S (Separate), C (Convert)
- [x] Task 8: HelpPanel.tsx — 7 collapsible sections, triggered from TitleBar help icon
- [x] Task 9: BitrateSelect per row (Auto/64k/96k/128k/192k/256k/320k); bitrate column in SQLite; set_bitrate Rust command; -b:a flag in ffmpeg convert
- [x] Task 10: output_filepath tracking — Python sends output_filepath in done callback; StatusPayload.output_filepath; update_job_output_filepath; stored in DB + frontend state
- [x] Task 11: Backend — enhance.py accepts strength (float 0.0–1.0); convert.py reads bitrate from DB (56/56 Pytest passing)
- [x] Task 12: CLAUDE.md updated, committed and pushed to GitHub

**Result:** 31/31 Vitest · 56/56 Pytest · cargo check clean

---

## Phase 7 — Extended Features (next)

- [ ] Task 1: Auto-save project state — Zustand persist middleware for UI state (queue, selection, panel state)
- [ ] Task 2: Spectrogram view — frequency domain visualization in WaveformPlayer (second tab alongside waveform)
- [ ] Task 3: Multi-language translations — fill translation strings for all 17 languages (currently only en.json has real content)
- [ ] Task 4: macOS packaging — .dmg / .app bundle target in tauri.conf.json + CI workflow
- [ ] Task 5: Custom output folder picker — Tauri dialog plugin integrated into SettingsPanel
- [ ] Task 6: History / recent files panel — sidebar panel showing previously processed files from SQLite
- [ ] Task 7: Drag-to-reorder queue items — DnD reordering with position column in SQLite
