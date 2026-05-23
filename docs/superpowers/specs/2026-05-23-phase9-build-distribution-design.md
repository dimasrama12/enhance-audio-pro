# Phase 9 — Build Pipeline & Release Distribution Design Spec

**Date:** 2026-05-23
**Status:** Approved
**Phase:** 9 of 9 (Final)

---

## Objective

Produce a distributable Windows MSI installer by wiring together:
1. PyInstaller sidecar build (`backend.exe`)
2. Tauri MSI bundle (`Enhance Audio Pro_0.1.0_x64_en-US.msi`)
3. Automated GitHub Actions CI/CD pipeline
4. Build helper scripts for local development

---

## Deliverables

| # | File | Description |
|---|---|---|
| 1 | `scripts/build-backend.ps1` | Builds PyInstaller sidecar, copies to `src-tauri/binaries/` |
| 2 | `scripts/build-app.ps1` | Orchestrates full build: backend → Tauri MSI |
| 3 | `.github/workflows/release.yml` | GitHub Actions: triggered on `v*` tags, produces MSI artifact |
| 4 | `CHANGELOG.md` | v0.1.0 release notes |
| 5 | Updated `package.json` | `build:backend` and `build:full` npm scripts |
| 6 | Updated master plan + CLAUDE.md | Phase 9 marked complete |

---

## Build Flow

```
scripts/build-app.ps1
  1. cd backend && pip install -r requirements.txt
  2. pyinstaller build.spec --distpath ../src-tauri/binaries-tmp
  3. copy binaries-tmp/backend.exe → src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe
  4. npm run tauri build
  5. Output: src-tauri/target/release/bundle/msi/*.msi
```

---

## GitHub Actions Workflow

**Trigger:** Push tag matching `v*` (e.g. `v0.1.0`)

**Steps:**
1. Checkout + setup Python 3.11 + Node 20 + Rust stable GNU toolchain
2. `pip install -r backend/requirements.txt`
3. `pyinstaller backend/build.spec` → copy exe to binaries dir
4. `npm ci` + `npm run tauri build`
5. Upload `*.msi` as GitHub Release asset

**Matrix:** Windows only for v0.1.0 (macOS DMG deferred to v0.2.0).

---

## Local Prerequisites

```
python 3.11
pip install pyinstaller
node 20 + npm
rust stable-x86_64-pc-windows-gnu
mingw64 gcc (D:\apk\mingw64\bin\)
CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro
```

---

## Output Artifacts

| File | Size (est.) |
|---|---|
| `backend.exe` (PyInstaller sidecar) | ~250–350 MB |
| `Enhance Audio Pro_0.1.0_x64_en-US.msi` | ~300–400 MB |

---

## Testing

- `npm run test` (Vitest) passes before build
- Pytest suite passes before build
- `cargo check` passes before `tauri build`
- Smoke test: install MSI, launch app, drag in an mp3, verify it appears in queue

---

## Error Handling

- If PyInstaller fails → build script exits non-zero, CI marks step failed
- If `cargo check` fails → `npm run tauri build` is not attempted
- Stub exe in `src-tauri/binaries/` keeps `cargo check` green between releases
