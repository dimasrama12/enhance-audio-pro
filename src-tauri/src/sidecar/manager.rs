use std::net::TcpListener;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

pub fn available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(8765)
}

/// Resolve the AI model storage directory.
/// Prefers D:\enhance-audio-pro-data\models if D: is available, otherwise
/// falls back to %APPDATA%\enhance-audio-pro\models.
pub fn models_dir() -> String {
    let d_path = std::path::Path::new("D:\\");
    if d_path.exists() {
        r"D:\enhance-audio-pro-data\models".to_string()
    } else {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        format!(r"{}\enhance-audio-pro\models", appdata)
    }
}

pub fn spawn(
    app: &AppHandle,
    port: u16,
    callback_port: u16,
) -> Result<CommandChild, Box<dyn std::error::Error>> {
    let models = models_dir();
    let db_path = app.path().app_data_dir()?.join("app.db");
    let (_rx, child) = app.shell()
        .sidecar("backend")
        .map_err(|e| e.to_string())?
        .env("BACKEND_PORT", port.to_string())
        .env("CALLBACK_PORT", callback_port.to_string())
        .env("MODELS_DIR", models)
        .env("DATABASE_PATH", db_path.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(child)
}
