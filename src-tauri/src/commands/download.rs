use tauri::State;

use crate::commands::IpcResponse;
use crate::AppState;

#[tauri::command]
pub fn start_model_download(state: State<'_, AppState>) -> IpcResponse<()> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    let payload = serde_json::json!({
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/wizard/download", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}
