@echo off
setlocal

set ROOT=%~dp0..
set BACKEND_DIR=%ROOT%\backend
set BINARIES_DIR=%ROOT%\src-tauri\binaries

echo [1/4] Activating Python venv...
call "%BACKEND_DIR%\.venv\Scripts\activate.bat"
if errorlevel 1 (echo ERROR: venv not found at %BACKEND_DIR%\.venv & exit /b 1)

echo [2/4] Installing PyInstaller...
pip install pyinstaller --quiet

echo [3/4] Building backend.exe with PyInstaller...
cd /d "%BACKEND_DIR%"
pyinstaller build.spec --distpath dist --workpath build_work --clean
if errorlevel 1 (echo ERROR: PyInstaller build failed. & exit /b 1)

echo [4/4] Copying to Tauri binaries...
copy /Y "dist\backend.exe" "%BINARIES_DIR%\backend-x86_64-pc-windows-gnu.exe"
if errorlevel 1 (echo ERROR: Copy failed. & exit /b 1)

echo.
echo Build complete. Run 'npm run tauri build' next to produce the MSI installer.
endlocal
