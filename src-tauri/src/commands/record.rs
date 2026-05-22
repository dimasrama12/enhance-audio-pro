use std::path::PathBuf;

use tauri::AppHandle;
use tauri::Manager;

use crate::commands::IpcResponse;

#[tauri::command]
pub fn save_recording(app_handle: AppHandle, bytes: Vec<u8>, filename: String) -> IpcResponse<String> {
    let dir = match app_handle.path().temp_dir() {
        Ok(d) => d,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    let path: PathBuf = dir.join(&filename);
    match std::fs::write(&path, &bytes) {
        Ok(()) => IpcResponse { success: true, data: Some(path.to_string_lossy().to_string()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}
