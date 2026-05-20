use std::net::TcpListener;
use tauri::AppHandle;

pub fn available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(8765)
}

// Spawns the Python sidecar. Fully wired in Task 12 once the binary is bundled.
pub fn spawn(_app: &AppHandle, _port: u16) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
