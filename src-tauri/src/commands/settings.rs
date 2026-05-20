use serde::{Deserialize, Serialize};
use tauri::State;

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
