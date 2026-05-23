# Build the Python FastAPI sidecar with PyInstaller
# Output: src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe
#
# Prerequisites:
#   python 3.11, pip, pyinstaller
#   Run from the repo root: .\scripts\build-backend.ps1

param(
    [string]$PythonExe = "python"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$BinariesDir = Join-Path $Root "src-tauri\binaries"
$DistDir = Join-Path $BackendDir "dist"
$TargetExe = Join-Path $BinariesDir "backend-x86_64-pc-windows-gnu.exe"

Write-Host "[1/4] Installing Python dependencies..."
& $PythonExe -m pip install -r "$BackendDir\requirements.txt" --quiet
if (-not $?) { Write-Error "pip install failed"; exit 1 }

Write-Host "[2/4] Running PyInstaller..."
Push-Location $BackendDir
& $PythonExe -m PyInstaller build.spec --distpath "$DistDir" --workpath "$BackendDir\build" --noconfirm
if (-not $?) { Pop-Location; Write-Error "PyInstaller failed"; exit 1 }
Pop-Location

$BuiltExe = Join-Path $DistDir "backend.exe"
if (-not (Test-Path $BuiltExe)) {
    Write-Error "Expected $BuiltExe not found after PyInstaller run"
    exit 1
}

Write-Host "[3/4] Copying exe to binaries dir..."
if (-not (Test-Path $BinariesDir)) { New-Item -ItemType Directory -Force $BinariesDir | Out-Null }
Copy-Item -Force $BuiltExe $TargetExe

Write-Host "[4/4] Done. Sidecar at: $TargetExe"
Write-Host "      Size: $([math]::Round((Get-Item $TargetExe).Length / 1MB, 1)) MB"
