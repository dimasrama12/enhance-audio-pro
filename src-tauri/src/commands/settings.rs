use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::commands::IpcResponse;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub output_folder: String,
    pub language: String,
    pub setup_complete: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            output_folder: String::new(),
            language: "en".to_string(),
            setup_complete: false,
        }
    }
}

#[tauri::command]
pub fn get_settings(_state: State<AppState>) -> IpcResponse<AppSettings> {
    IpcResponse {
        success: true,
        data: Some(AppSettings::default()),
        error: None,
    }
}

#[tauri::command]
pub fn save_settings(_state: State<AppState>, _settings: AppSettings) -> IpcResponse<()> {
    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}

fn scratch_disk_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.join("scratch_disk.txt"))
}

#[tauri::command]
pub fn get_scratch_disk_dir(app_handle: AppHandle) -> IpcResponse<String> {
    let path = match scratch_disk_path(&app_handle) {
        Ok(p) => p,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e) },
    };
    let value = std::fs::read_to_string(&path).unwrap_or_default().trim().to_string();
    IpcResponse { success: true, data: Some(value), error: None }
}

#[tauri::command]
pub fn save_scratch_disk_dir(app_handle: AppHandle, path: String) -> IpcResponse<()> {
    let file_path = match scratch_disk_path(&app_handle) {
        Ok(p) => p,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e) },
    };
    match std::fs::write(&file_path, path.trim()) {
        Ok(()) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}
