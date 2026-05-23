# Full production build: Python sidecar + Tauri MSI
# Output: src-tauri/target/release/bundle/msi/*.msi
#
# Prerequisites:
#   python 3.11, pip, pyinstaller, node 20, npm, rust stable-x86_64-pc-windows-gnu
#   CARGO_TARGET_DIR should point to a drive with enough space (see CLAUDE.md §18.12)
#   Run from the repo root: .\scripts\build-app.ps1

param(
    [string]$PythonExe = "python",
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Enhance Audio Pro — Full Build ==="
Write-Host "Root: $Root"

# Step 1: Build Python sidecar
if (-not $SkipBackend) {
    Write-Host ""
    Write-Host "--- Step 1: Build Python sidecar ---"
    & "$PSScriptRoot\build-backend.ps1" -PythonExe $PythonExe
    if (-not $?) { Write-Error "Backend build failed"; exit 1 }
} else {
    Write-Host "--- Step 1: Skipped (--SkipBackend) ---"
}

# Step 2: Run frontend + Tauri tests
Write-Host ""
Write-Host "--- Step 2: Run test suites ---"
Push-Location $Root
& npm run test -- --run
if (-not $?) { Pop-Location; Write-Error "Vitest failed"; exit 1 }
Pop-Location

Push-Location "$Root\backend"
& $PythonExe -m pytest tests/ -q --no-header -p no:langsmith
if (-not $?) { Pop-Location; Write-Error "Pytest failed"; exit 1 }
Pop-Location

# Step 3: Tauri build
Write-Host ""
Write-Host "--- Step 3: npm run tauri build ---"
Push-Location $Root
& npm run tauri build
if (-not $?) { Pop-Location; Write-Error "Tauri build failed"; exit 1 }
Pop-Location

# Report output
$MsiDir = Join-Path $Root "src-tauri\target\release\bundle\msi"
$Msi = Get-ChildItem $MsiDir -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($Msi) {
    Write-Host ""
    Write-Host "=== BUILD COMPLETE ==="
    Write-Host "Installer: $($Msi.FullName)"
    Write-Host "Size:      $([math]::Round($Msi.Length / 1MB, 1)) MB"
} else {
    Write-Host ""
    Write-Host "=== BUILD COMPLETE (MSI path not found — check src-tauri/target/release/bundle/) ==="
}
