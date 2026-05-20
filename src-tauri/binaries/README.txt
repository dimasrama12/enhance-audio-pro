Place compiled backend.exe here for production builds.

The sidecar binary must be named:
  backend-x86_64-pc-windows-gnu.exe   (Windows)
  backend-x86_64-apple-darwin         (macOS)
  backend-x86_64-unknown-linux-gnu    (Linux)

Build command (run from backend/):
  pyinstaller backend.spec
  copy dist\backend.exe ..\src-tauri\binaries\backend-x86_64-pc-windows-gnu.exe
