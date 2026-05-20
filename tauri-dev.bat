@echo off
set CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro
set PATH=C:\Users\User\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\gcc-ld;C:\Users\User\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin;%PATH%
npm run tauri dev
