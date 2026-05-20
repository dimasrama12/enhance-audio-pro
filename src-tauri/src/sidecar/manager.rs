use std::net::TcpListener;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub fn available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(8765)
}

pub fn spawn(app: &AppHandle, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    app.shell()
        .sidecar("backend")
        .map_err(|e| e.to_string())?
        .env("BACKEND_PORT", port.to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
