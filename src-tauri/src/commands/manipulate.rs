use serde_json::json;
use tauri::State;

use crate::commands::IpcResponse;
use crate::AppState;

#[tauri::command]
pub async fn export_volume_adjusted_audio(
    state: State<'_, AppState>,
    input_path: String,
    dest_path: String,
    db_gain: f64,
) -> Result<IpcResponse<()>, String> {
    let backend_port = state.backend_port;
    let payload = json!({
        "input_path": input_path,
        "output_path": dest_path,
        "db_gain": db_gain,
    });
    let url = format!("http://127.0.0.1:{}/export_volume", backend_port);
    match reqwest::Client::new().post(&url).json(&payload).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                Ok(IpcResponse { success: true, data: Some(()), error: None })
            } else {
                let err_msg = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Ok(IpcResponse { success: false, data: None, error: Some(err_msg) })
            }
        }
        Err(e) => Ok(IpcResponse { success: false, data: None, error: Some(e.to_string()) })
    }
}
